import type { SongContextInput, SongSection } from "@verbo/shared";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../services/firebase/firestore.js";
import type { VersionDoc, WithId } from "../types/firestore.js";

function versionsCollection(uid: string, songId: string) {
  return collection(db, "users", uid, "songs", songId, "versions");
}

function versionDoc(uid: string, songId: string, versionId: string) {
  return doc(db, "users", uid, "songs", songId, "versions", versionId);
}

export interface NewVersionInput {
  versionName: string;
  lyrics: string;
  sections: SongSection[];
  context: SongContextInput;
  authorNotes?: string;
  sourceVersionId?: string;
}

export async function createVersion(
  uid: string,
  songId: string,
  input: NewVersionInput
): Promise<string> {
  const ref = await addDoc(versionsCollection(uid, songId), {
    versionName: input.versionName,
    lyrics: input.lyrics,
    sections: input.sections,
    context: input.context,
    authorNotes: input.authorNotes ?? null,
    sourceVersionId: input.sourceVersionId ?? null,
    analysisStatus: "pending",
    currentAnalysisId: null,
    approved: false,
    findingDecisions: {},
    userId: uid,
    status: "active",
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVersion(
  uid: string,
  songId: string,
  versionId: string,
  patch: Partial<
    Pick<
      VersionDoc,
      "lyrics" | "sections" | "context" | "authorNotes" | "approved" | "findingDecisions"
    >
  >
): Promise<void> {
  await updateDoc(versionDoc(uid, songId, versionId), { ...patch, updatedAt: serverTimestamp() });
}

export async function setFindingDecision(
  uid: string,
  songId: string,
  versionId: string,
  findingId: string,
  decision: "accepted" | "ignored" | undefined
): Promise<void> {
  await updateDoc(versionDoc(uid, songId, versionId), {
    [`findingDecisions.${findingId}`]: decision ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function getVersion(
  uid: string,
  songId: string,
  versionId: string
): Promise<WithId<VersionDoc> | null> {
  const snap = await getDoc(versionDoc(uid, songId, versionId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as VersionDoc) } : null;
}

export function subscribeToVersions(
  uid: string,
  songId: string,
  callback: (versions: WithId<VersionDoc>[]) => void
): Unsubscribe {
  const q = query(versionsCollection(uid, songId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as VersionDoc) })));
  });
}

export function subscribeToVersion(
  uid: string,
  songId: string,
  versionId: string,
  callback: (version: WithId<VersionDoc> | null) => void
): Unsubscribe {
  return onSnapshot(versionDoc(uid, songId, versionId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...(snap.data() as VersionDoc) } : null);
  });
}
