import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { RevisionModeSchema } from "@verbo/shared";
import { anthropicApiKeySecret } from "../services/env.js";
import { db } from "../services/firestoreAdmin.js";
import { runAnalysis } from "../services/analysisService.js";
import { requireUid } from "../security/auth.js";
import { assertLyricsSizeWithinLimit, assertVersionExists } from "../security/ownership.js";
import { assertWithinRateLimit } from "../security/rateLimit.js";
import { summarizeForLog } from "../services/safeLog.js";

const InputSchema = z.object({
  songId: z.string().min(1),
  versionId: z.string().min(1),
  revisionMode: RevisionModeSchema.optional(),
});

export const analyzeLyrics = onCall(
  { secrets: [anthropicApiKeySecret], timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const uid = requireUid(request);
    const input = InputSchema.parse(request.data);
    logger.info("analyzeLyrics called", { uid, ...summarizeForLog(input) });

    await assertWithinRateLimit(uid, "analyzeLyrics", 30);
    const versionData = await assertVersionExists(uid, input.songId, input.versionId);

    const lyrics: string = versionData.lyrics ?? "";
    assertLyricsSizeWithinLimit(lyrics);

    const { mode, result } = await runAnalysis({
      songTitle: versionData.songTitle,
      author: versionData.author,
      lyrics,
      sections: versionData.sections ?? [],
      context: versionData.context ?? {},
      revisionMode: input.revisionMode ?? "completa",
      bibleTranslationPreference: "dominio_publico_almeida",
    });

    const analysisRef = db.collection(`users/${uid}/songs/${input.songId}/analyses`).doc();
    await analysisRef.set({
      versionId: input.versionId,
      mode,
      result,
      userId: uid,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.doc(`users/${uid}/songs/${input.songId}/versions/${input.versionId}`).update({
      analysisStatus: "completed",
      currentAnalysisId: analysisRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Denormalized onto the song doc so the library list can show a
    // preview without opening a listener per song for every analysis.
    await db.doc(`users/${uid}/songs/${input.songId}`).update({
      lastAnalysisSummary: result.overview.perceivedCentralMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { mode, analysisId: analysisRef.id, result };
  }
);
