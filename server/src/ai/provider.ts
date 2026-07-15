import type { AIProducedAnalysis, AnalyzeRequest, GrammarFinding, ProsodyFinding, SongSection } from "@verbo/shared";

export interface LyricsAnalysisInput {
  request: AnalyzeRequest;
  sections: SongSection[];
  deterministicGrammar: GrammarFinding[];
  prosody: ProsodyFinding[];
}

export interface AIAnalysisProvider {
  readonly mode: "live" | "demo";
  analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis>;
}
