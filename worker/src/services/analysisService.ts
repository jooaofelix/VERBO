import {
  AnalysisResultSchema,
  type AnalysisResult,
  type AnalyzeRequest,
  type SongSection,
} from "@verbo/shared";
import { getAIProvider } from "../providers/index.js";
import { enrichBibleReferences } from "./bible/lookup.js";
import { runDeterministicChecks } from "./grammar/deterministicChecks.js";
import { analyzeProsody } from "./grammar/prosody.js";
import { suggestSections } from "./grammar/sectionSplitter.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `analysis-${Date.now()}-${counter}`;
}

/**
 * Orchestrates the full analysis pipeline for one request:
 *   1. section splitting (only if the caller didn't already provide sections)
 *   2. deterministic grammar + prosody passes (never AI, always cited)
 *   3. AI structured analysis (Workers AI, or a demo fallback when the "AI"
 *      binding isn't available)
 *   4. Bible reference enrichment against the curated dataset (safety net
 *      against hallucinated verse text)
 *   5. final schema validation before anything reaches the client
 */
export async function runAnalysis(
  request: AnalyzeRequest,
  ai: Ai | undefined
): Promise<{ mode: "live" | "demo"; result: AnalysisResult }> {
  const sections: SongSection[] =
    request.sections.length > 0 ? request.sections : suggestSections(request.lyrics);

  const deterministicGrammar = runDeterministicChecks(sections);
  const prosody = analyzeProsody(sections);

  const provider = getAIProvider(ai);
  const aiResult = await provider.analyzeLyrics({
    request,
    sections,
    deterministicGrammar,
    prosody,
  });

  const candidate: AnalysisResult = {
    id: nextId(),
    createdAt: new Date().toISOString(),
    revisionMode: request.revisionMode,
    ...aiResult,
    bibleReferences: enrichBibleReferences(aiResult.bibleReferences),
    grammarFindings: [...deterministicGrammar, ...aiResult.grammarFindings],
    prosodyFindings: prosody,
  };

  const result = AnalysisResultSchema.parse(candidate);

  return { mode: provider.mode, result };
}
