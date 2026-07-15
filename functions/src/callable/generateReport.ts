import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertSongExists, assertVersionExists } from "../security/ownership.js";
import { db } from "../services/firestoreAdmin.js";
import { buildFinalReport } from "../services/report.js";

const InputSchema = z.object({
  songId: z.string().min(1),
  versionId: z.string().min(1),
  analysisId: z.string().min(1),
});

export const generateReport = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireUid(request);
  const input = InputSchema.parse(request.data);

  const song = await assertSongExists(uid, input.songId);
  const version = await assertVersionExists(uid, input.songId, input.versionId);
  const analysisSnap = await db
    .doc(`users/${uid}/songs/${input.songId}/analyses/${input.analysisId}`)
    .get();

  if (!analysisSnap.exists) {
    throw new HttpsError("not-found", "Análise não encontrada ou não pertence a este usuário.");
  }

  const report = buildFinalReport(song, version, analysisSnap.data()!.result);

  const reportRef = db.collection(`users/${uid}/reports`).doc();
  await reportRef.set({
    songId: input.songId,
    versionId: input.versionId,
    analysisId: input.analysisId,
    report,
    userId: uid,
    status: "completed",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { reportId: reportRef.id, report };
});
