import type { AIProducedAnalysis, AnalyzeRequest, GrammarFinding, ProsodyFinding, SongSection } from "@verbo/shared";
import type { ResolvedUserReference } from "../services/bible/lookup.js";

export interface LyricsAnalysisInput {
  request: AnalyzeRequest;
  sections: SongSection[];
  deterministicGrammar: GrammarFinding[];
  prosody: ProsodyFinding[];
  /** Real verse text for each composer-provided base reference, already resolved (curated dataset / abibliadigital.com.br) — see resolveUserProvidedReferences. */
  resolvedUserReferences?: ResolvedUserReference[];
}

export interface AIAnalysisProvider {
  readonly mode: "live" | "demo";
  analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis>;
}
