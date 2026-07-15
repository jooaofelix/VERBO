import type { AnalysisResult } from "@verbo/shared";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
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

/**
 * The Cloudflare Worker never touches Firestore — it just returns the
 * analysis result over HTTP. The authenticated client is responsible for
 * persisting it, exactly like any other write in this app, subject to
 * firestore.rules. This writes the new analysis doc and updates the
 * parent version/song docs in a single atomic batch.
 */
export async function saveAnalysisResult(
  uid: string,
  songId: string,
  versionId: string,
  mode: "live" | "demo",
  result: AnalysisResult
): Promise<string> {
  const batch = writeBatch(db);

  const analysisRef = doc(collection(db, "users", uid, "songs", songId, "analyses"));
  batch.set(analysisRef, {
    versionId,
    mode,
    result,
    userId: uid,
    status: "completed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const versionRef = doc(db, "users", uid, "songs", songId, "versions", versionId);
  batch.update(versionRef, {
    analysisStatus: "completed",
    currentAnalysisId: analysisRef.id,
    updatedAt: serverTimestamp(),
  });

  const songRef = doc(db, "users", uid, "songs", songId);
  batch.update(songRef, {
    lastAnalysisSummary: result.overview.perceivedCentralMessage,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return analysisRef.id;
}
