import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../services/firebase/firestore.js";

/**
 * Creates users/{uid} on first sign-in if it doesn't exist yet. Safe to call
 * on every login — it's a no-op merge after the first time.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      isAnonymous: user.isAnonymous,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
