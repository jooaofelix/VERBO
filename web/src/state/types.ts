import type { AnalysisResult, SongContextInput, SongSection } from "@verbo/shared";

export interface SongVersion {
  id: string;
  versionName: string;
  createdAt: string;
  lyrics: string;
  sections: SongSection[];
  context: SongContextInput;
  authorNotes?: string;
  sourceVersionId?: string;
  analysis?: AnalysisResult;
  analysisMode?: "live" | "demo";
  analysisError?: string;
  approved?: boolean;
  findingDecisions?: Record<string, "accepted" | "ignored">;
}

export interface Song {
  id: string;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  versionOrder: string[];
  versions: Record<string, SongVersion>;
}
