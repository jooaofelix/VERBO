import {
  AnalysisResultSchema,
  type AnalysisResult,
  type AnalyzeRequest,
  type BibleReference,
  type GrammarFinding,
  type SongSection,
} from "@verbo/shared";
import { getAIProvider } from "../providers/index.js";
import { detectCuratedAllusions, enrichBibleReferences } from "./bible/lookup.js";
import { runDeterministicChecks } from "./grammar/deterministicChecks.js";
import { runLanguageToolCheck } from "./grammar/languageTool.js";
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

function normalizeExcerpt(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LanguageTool findings are appended after the deterministic + AI ones,
 * skipping anything that already flags essentially the same excerpt —
 * a real (never fabricated) grammar check should add coverage, not noise.
 */
function mergeGrammarFindings(base: GrammarFinding[], languageTool: GrammarFinding[]): GrammarFinding[] {
  const seen = new Set(base.map((f) => normalizeExcerpt(f.originalExcerpt)));
  const additional: GrammarFinding[] = [];
  for (const finding of languageTool) {
    const key = normalizeExcerpt(finding.originalExcerpt);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    additional.push(finding);
  }
  return [...base, ...additional];
}

/**
 * Orchestrates the full analysis pipeline for one request:
 *   1. section splitting (only if the caller didn't already provide sections)
 *   2. deterministic grammar + prosody passes (never AI, always cited), plus
 *      a real rule-based Portuguese check via the free LanguageTool API —
 *      run in parallel with the AI call, and never allowed to fail the
 *      request: any error/timeout there just means fewer findings, not a
 *      broken analysis
 *   3. AI structured analysis (Workers AI, or a demo fallback when the "AI"
 *      binding isn't available)
 *   4. Bible reference enrichment against the curated dataset first, then
 *      (only for references not found there, and only if configured) the
 *      abibliadigital.com.br free API — both are a safety net against
 *      hallucinated verse text, never a source of it
 *   5. final schema validation before anything reaches the client
 */
export async function runAnalysis(
  request: AnalyzeRequest,
  ai: Ai | undefined,
  abibliadigitalToken?: string
): Promise<{ mode: "live" | "demo"; result: AnalysisResult }> {
  const sections: SongSection[] =
    request.sections.length > 0 ? request.sections : suggestSections(request.lyrics);

  const deterministicGrammar = runDeterministicChecks(sections);
  const prosody = analyzeProsody(sections);

  const provider = getAIProvider(ai);
  const [aiResult, languageToolFindings] = await Promise.all([
    provider.analyzeLyrics({ request, sections, deterministicGrammar, prosody }),
    runLanguageToolCheck(request.lyrics).catch(() => []),
  ]);

  const curatedAllusions = detectCuratedAllusions(request.lyrics);
  const bibleReferences = mergeBibleReferences(curatedAllusions, aiResult.bibleReferences);

  const candidate: AnalysisResult = {
    id: nextId(),
    createdAt: new Date().toISOString(),
    revisionMode: request.revisionMode,
    ...aiResult,
    bibleReferences: await enrichBibleReferences(bibleReferences, abibliadigitalToken),
    grammarFindings: mergeGrammarFindings([...deterministicGrammar, ...aiResult.grammarFindings], languageToolFindings),
    prosodyFindings: prosody,
  };

  const result = AnalysisResultSchema.parse(candidate);

  return { mode: provider.mode, result };
}
