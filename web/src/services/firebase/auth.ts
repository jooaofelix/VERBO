import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseApp } from "./app.js";

export const auth = getAuth(firebaseApp);

// Session persists across browser restarts (not just the tab) until the
// user explicitly logs out.
void setPersistence(auth, browserLocalPersistence);

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Demo mode without a real account: an anonymous Firebase Auth user still
 * gets its own UID, so its data is never mixed with another visitor's —
 * each anonymous session is isolated the same way a real account would be.
 */
export async function signInAsDemoUser(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
