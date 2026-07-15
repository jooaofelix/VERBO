import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { auth } from "./auth.js";
import { db } from "./firestore.js";

let connected = false;

/**
 * Points every Firebase client at the local Emulator Suite instead of
 * production, gated behind VITE_USE_FIREBASE_EMULATORS so a normal `npm run
 * dev` against a real project never accidentally talks to a local emulator
 * (or vice versa). Safe to call more than once — only connects on the first call.
 *
 * There's no Storage or Functions emulator to connect to anymore: this MVP
 * has no Firebase Storage and no Cloud Functions — analysis runs on the
 * Cloudflare Worker instead (see services/worker/client.ts), which is
 * pointed at via VITE_WORKER_URL, not an emulator connection.
 */
export function connectToFirebaseEmulatorsIfConfigured(): void {
  if (connected) return;
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "true") return;

  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connected = true;
}
