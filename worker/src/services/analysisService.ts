import {
  AnalysisResultSchema,
  type AnalysisResult,
  type AnalyzeRequest,
  type BibleReference,
  type SongSection,
} from "@verbo/shared";
import { getAIProvider } from "../providers/index.js";
import { detectCuratedAllusions, enrichBibleReferences } from "./bible/lookup.js";
import { runDeterministicChecks } from "./grammar/deterministicChecks.js";
import { analyzeProsody } from "./grammar/prosody.js";
import { suggestSections } from "./grammar/sectionSplitter.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `analysis-${Date.now()}-${counter}`;
}

/**
 * Curated, phrase-detected allusions are never missed just because the AI's
 * biblical-area call failed or didn't catch them — they take priority, and
 * an AI-identified reference for the same passage is dropped as a duplicate.
 */
function mergeBibleReferences(curated: BibleReference[], aiFound: BibleReference[]): BibleReference[] {
  const seen = new Set(curated.map((r) => r.referenceLabel.toLowerCase().trim()));
  const deduped = aiFound.filter((r) => {
    const key = r.referenceLabel.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...curated, ...deduped];
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

  const curatedAllusions = detectCuratedAllusions(request.lyrics);
  const bibleReferences = mergeBibleReferences(curatedAllusions, aiResult.bibleReferences);

  const candidate: AnalysisResult = {
    id: nextId(),
    createdAt: new Date().toISOString(),
    revisionMode: request.revisionMode,
    ...aiResult,
    bibleReferences: enrichBibleReferences(bibleReferences),
    grammarFindings: [...deterministicGrammar, ...aiResult.grammarFindings],
    prosodyFindings: prosody,
  };

  const result = AnalysisResultSchema.parse(candidate);

  return { mode: provider.mode, result };
}
