import type { AnalysisResult, FinalReport, SongContextInput, SongSection } from "@verbo/shared";
import type { Timestamp } from "firebase/firestore";

export interface UserProfileDoc {
  displayName?: string;
  email?: string;
  photoURL?: string;
  isAnonymous: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SongDoc {
  title: string;
  author?: string;
  language: string;
  congregational: boolean;
  hasAudio: boolean;
  currentVersionId?: string;
  lastAnalysisSummary?: string;
  userId: string;
  status: "active" | "archived";
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VersionDoc {
  versionName: string;
  lyrics: string;
  sections: SongSection[];
  context: SongContextInput;
  authorNotes?: string;
  sourceVersionId?: string;
  analysisStatus?: "pending" | "completed" | "error";
  currentAnalysisId?: string;
  approved?: boolean;
  findingDecisions?: Record<string, "accepted" | "ignored">;
  userId: string;
  status: "active" | "archived";
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AnalysisDoc {
  versionId: string;
  mode: "live" | "demo";
  result: AnalysisResult;
  userId: string;
  status: "completed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReportDoc {
  songId: string;
  versionId: string;
  analysisId: string;
  report: FinalReport;
  userId: string;
  status: "completed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FileMetadataDoc {
  path: string;
  name: string;
  kind: string;
  contentType: string | null;
  size: number;
  userId: string;
  songId: string | null;
  status: "completed";
  uploadedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type WithId<T> = T & { id: string };
