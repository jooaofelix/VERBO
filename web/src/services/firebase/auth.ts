import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseApp } from "./app.js";

export const auth = getAuth(firebaseApp);

// Session persists across browser restarts (not just the tab) until the
// user explicitly logs out. Kept as an awaitable promise (instead of a
// fire-and-forget `void`) so callers that need the guarantee — e.g. before
// a redirect sign-in survives a full page reload — can await it, without
// this module-load call itself blocking anything.
export const localPersistenceReady: Promise<void> = setPersistence(auth, browserLocalPersistence);

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Forces Google's account chooser every time instead of silently trying to
 * reuse a stale/incomplete session — that silent reuse is what produced an
 * empty popup that closed itself with no visible error.
 */
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Must be invoked synchronously from the click handler that triggers it —
 * with nothing `await`ed first — because some browsers only allow a popup
 * to open inside the same event-loop turn as the user gesture.
 */
export function signInWithGooglePopup(): Promise<User> {
  return signInWithPopup(auth, createGoogleProvider()).then((credential) => credential.user);
}

/** Full-page fallback for when the popup itself is blocked or keeps failing. */
export function signInWithGoogleRedirect(): Promise<never> {
  return signInWithRedirect(auth, createGoogleProvider()) as Promise<never>;
}

/**
 * Must run once at app startup, and its result awaited before concluding
 * the user isn't authenticated — a sign-in started via signInWithRedirect
 * only resolves here, after the full-page round trip back from Google.
 */
export function completeGoogleRedirectSignIn(): Promise<User | null> {
  return getRedirectResult(auth).then((credential) => credential?.user ?? null);
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
