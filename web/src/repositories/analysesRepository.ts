import type { AnalysisResult, FinalReport, RevisionMode, SongSection } from "@verbo/shared";
import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { callFunction } from "../services/firebase/functions.js";
import { db } from "../services/firebase/firestore.js";
import type { AnalysisDoc, WithId } from "../types/firestore.js";

function analysisDoc(uid: string, songId: string, analysisId: string) {
  return doc(db, "users", uid, "songs", songId, "analyses", analysisId);
}

export async function getAnalysis(
  uid: string,
  songId: string,
  analysisId: string
): Promise<WithId<AnalysisDoc> | null> {
  const snap = await getDoc(analysisDoc(uid, songId, analysisId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as AnalysisDoc) } : null;
}

export function subscribeToAnalysis(
  uid: string,
  songId: string,
  analysisId: string,
  callback: (analysis: WithId<AnalysisDoc> | null) => void
): Unsubscribe {
  return onSnapshot(analysisDoc(uid, songId, analysisId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...(snap.data() as AnalysisDoc) } : null);
  });
}

// ---- Cloud Functions callables (analysis is always computed server-side) ----

export async function callAnalyzeLyrics(input: {
  songId: string;
  versionId: string;
  revisionMode?: RevisionMode;
}): Promise<{ mode: "live" | "demo"; analysisId: string; result: AnalysisResult }> {
  return callFunction("analyzeLyrics", input);
}

export async function callSuggestSections(lyrics: string): Promise<{ sections: SongSection[] }> {
  return callFunction("suggestSections", { lyrics });
}

export async function callCompareVersions(input: {
  songId: string;
  versionAId: string;
  versionBId: string;
}): Promise<{
  diff: Array<{ text: string; type: "same" | "added" | "removed" }>;
  dimensions: Record<string, { a: unknown; b: unknown }>;
  note: string;
}> {
  return callFunction("compareVersions", input);
}

export async function callGenerateReport(input: {
  songId: string;
  versionId: string;
  analysisId: string;
}): Promise<{ reportId: string; report: FinalReport }> {
  return callFunction("generateReport", input);
}
