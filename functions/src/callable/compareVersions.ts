import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertVersionExists } from "../security/ownership.js";
import { diffWords } from "../services/diff.js";
import { db } from "../services/firestoreAdmin.js";

const InputSchema = z.object({
  songId: z.string().min(1),
  versionAId: z.string().min(1),
  versionBId: z.string().min(1),
});

const CONSISTENCY_LABEL: Record<string, string> = {
  muito_consistente: "Muito consistente",
  consistente: "Consistente",
  parcialmente_consistente: "Parcialmente consistente",
  precisa_revisao: "Precisa de revisão",
  nao_foi_possivel_determinar: "Não foi possível determinar",
};

async function latestAnalysisFor(uid: string, songId: string, versionId: string) {
  const versionSnap = await db.doc(`users/${uid}/songs/${songId}/versions/${versionId}`).get();
  const currentAnalysisId = versionSnap.data()?.currentAnalysisId as string | undefined;
  if (!currentAnalysisId) return null;
  const analysisSnap = await db
    .doc(`users/${uid}/songs/${songId}/analyses/${currentAnalysisId}`)
    .get();
  return analysisSnap.data()?.result ?? null;
}

/**
 * Compares two versions on objective facts only — word-level diff plus a
 * handful of countable signals from each version's latest stored analysis.
 * Deliberately never declares one version "better": that judgment belongs
 * to the composer, not the tool.
 */
export const compareVersions = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireUid(request);
  const input = InputSchema.parse(request.data);

  const [versionA, versionB] = await Promise.all([
    assertVersionExists(uid, input.songId, input.versionAId),
    assertVersionExists(uid, input.songId, input.versionBId),
  ]);

  const [analysisA, analysisB] = await Promise.all([
    latestAnalysisFor(uid, input.songId, input.versionAId),
    latestAnalysisFor(uid, input.songId, input.versionBId),
  ]);

  const tokens = diffWords(versionA.lyrics ?? "", versionB.lyrics ?? "");

  return {
    diff: tokens,
    dimensions: {
      consistencyWithStatedIntent: {
        a: analysisA ? CONSISTENCY_LABEL[analysisA.overview?.consistencyWithStatedIntent] : null,
        b: analysisB ? CONSISTENCY_LABEL[analysisB.overview?.consistencyWithStatedIntent] : null,
      },
      grammarFindingsCount: {
        a: analysisA?.grammarFindings?.length ?? null,
        b: analysisB?.grammarFindings?.length ?? null,
      },
      bibleReferencesCount: {
        a: analysisA?.bibleReferences?.length ?? null,
        b: analysisB?.bibleReferences?.length ?? null,
      },
      attentionPointsCount: {
        a: analysisA?.overview?.attentionPoints?.length ?? null,
        b: analysisB?.overview?.attentionPoints?.length ?? null,
      },
      wordCount: {
        a: (versionA.lyrics ?? "").split(/\s+/).filter(Boolean).length,
        b: (versionB.lyrics ?? "").split(/\s+/).filter(Boolean).length,
      },
    },
    note: "A versão mais recente não é automaticamente melhor — compare os fatos e decida.",
  };
});
