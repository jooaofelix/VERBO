import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../services/firestoreAdmin.js";

export const MAX_LYRICS_LENGTH = 20_000;

export function assertLyricsSizeWithinLimit(lyrics: string): void {
  if (lyrics.length > MAX_LYRICS_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `A letra excede o limite de ${MAX_LYRICS_LENGTH} caracteres permitido por análise.`
    );
  }
}

/**
 * All documents in this project live under users/{uid}/..., where {uid}
 * always comes from the verified auth token (see security/auth.ts) — so a
 * caller can structurally never reach another user's song by path alone.
 * This helper additionally confirms the document actually exists, turning a
 * typo'd or deleted songId into a clean 404 instead of a confusing partial
 * read downstream.
 */
export async function assertSongExists(uid: string, songId: string): Promise<FirebaseFirestore.DocumentData> {
  const snap = await db.doc(`users/${uid}/songs/${songId}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Composição não encontrada ou não pertence a este usuário.");
  }
  return snap.data()!;
}

export async function assertVersionExists(
  uid: string,
  songId: string,
  versionId: string
): Promise<FirebaseFirestore.DocumentData> {
  await assertSongExists(uid, songId);
  const snap = await db.doc(`users/${uid}/songs/${songId}/versions/${versionId}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Versão não encontrada ou não pertence a este usuário.");
  }
  return snap.data()!;
}

export async function assertAnalysisExists(
  uid: string,
  songId: string,
  analysisId: string
): Promise<FirebaseFirestore.DocumentData> {
  await assertSongExists(uid, songId);
  const snap = await db.doc(`users/${uid}/songs/${songId}/analyses/${analysisId}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Análise não encontrada ou não pertence a este usuário.");
  }
  return snap.data()!;
}
