import {
  addDoc,
  collection,
  deleteDoc,
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
import type { SongDoc, WithId } from "../types/firestore.js";

function songsCollection(uid: string) {
  return collection(db, "users", uid, "songs");
}

function songDoc(uid: string, songId: string) {
  return doc(db, "users", uid, "songs", songId);
}

export interface NewSongInput {
  title: string;
  author?: string;
  congregational: boolean;
  hasAudio: boolean;
}

export async function createSong(uid: string, input: NewSongInput): Promise<string> {
  const ref = await addDoc(songsCollection(uid), {
    title: input.title || "Composição sem título",
    author: input.author ?? null,
    language: "pt-BR",
    congregational: input.congregational,
    hasAudio: input.hasAudio,
    currentVersionId: null,
    userId: uid,
    status: "active",
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSong(
  uid: string,
  songId: string,
  patch: Partial<Pick<SongDoc, "title" | "author" | "congregational" | "hasAudio" | "currentVersionId" | "status">>
): Promise<void> {
  await updateDoc(songDoc(uid, songId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteSong(uid: string, songId: string): Promise<void> {
  await deleteDoc(songDoc(uid, songId));
}

export async function getSong(uid: string, songId: string): Promise<WithId<SongDoc> | null> {
  const snap = await getDoc(songDoc(uid, songId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as SongDoc) }) : null;
}

export function subscribeToSongs(
  uid: string,
  callback: (songs: WithId<SongDoc>[]) => void
): Unsubscribe {
  const q = query(songsCollection(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as SongDoc) })));
  });
}

export function subscribeToSong(
  uid: string,
  songId: string,
  callback: (song: WithId<SongDoc> | null) => void
): Unsubscribe {
  return onSnapshot(songDoc(uid, songId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...(snap.data() as SongDoc) } : null);
  });
}
