import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertAnalysisExists } from "../security/ownership.js";

const InputSchema = z.object({
  songId: z.string().min(1),
  analysisId: z.string().min(1),
});

/** Read-only projection of the theological slice of a stored analysis — see detectBibleReferences.ts for why this doesn't re-run the AI. */
export const analyzeTheology = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireUid(request);
  const input = InputSchema.parse(request.data);
  const analysis = await assertAnalysisExists(uid, input.songId, input.analysisId);

  return { theologicalClaims: analysis.result?.theologicalClaims ?? [] };
});
