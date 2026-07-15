import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertLyricsSizeWithinLimit } from "../security/ownership.js";
import { suggestSections as computeSuggestedSections } from "../services/grammar/sectionSplitter.js";

const InputSchema = z.object({ lyrics: z.string().min(1) });

/**
 * Not one of the eight analysis callables, but needed to preserve the
 * existing lyrics-editor feature (auto-suggesting verse/chorus/bridge
 * sections) from before this Firebase migration. Pure and cheap — no AI
 * call, no Firestore write — so it only requires auth, not a rate limit.
 */
export const suggestSections = onCall({ timeoutSeconds: 15 }, async (request) => {
  requireUid(request);
  const input = InputSchema.parse(request.data);
  assertLyricsSizeWithinLimit(input.lyrics);

  try {
    return { sections: computeSuggestedSections(input.lyrics) };
  } catch {
    throw new HttpsError("internal", "Não foi possível sugerir a divisão em seções.");
  }
});
