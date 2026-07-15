import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertAnalysisExists } from "../security/ownership.js";

const InputSchema = z.object({
  songId: z.string().min(1),
  analysisId: z.string().min(1),
});

/**
 * analyzeLyrics already produces bibleReferences + biblicalContext as part
 * of its single structured AI call and persists them on the analysis
 * document. This callable is a read-only projection of that same document —
 * it does not trigger a second AI call — so the UI (or a future
 * integration) can fetch just this slice without paying for or waiting on
 * a full re-analysis.
 */
export const detectBibleReferences = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireUid(request);
  const input = InputSchema.parse(request.data);
  const analysis = await assertAnalysisExists(uid, input.songId, input.analysisId);

  return {
    bibleReferences: analysis.result?.bibleReferences ?? [],
    biblicalContext: analysis.result?.biblicalContext ?? [],
  };
});
