import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectFunctionsEmulator } from "firebase/functions";
import { connectStorageEmulator } from "firebase/storage";
import { auth } from "./auth.js";
import { db } from "./firestore.js";
import { functionsInstance } from "./functions.js";
import { storage } from "./storage.js";

let connected = false;

/**
 * Points every Firebase client at the local Emulator Suite instead of
 * production, gated behind VITE_USE_FIREBASE_EMULATORS so a normal `npm run
 * dev` against a real project never accidentally talks to a local emulator
 * (or vice versa). Safe to call more than once — only connects on the first call.
 */
export function connectToFirebaseEmulatorsIfConfigured(): void {
  if (connected) return;
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "true") return;

  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functionsInstance, "127.0.0.1", 5001);
  connected = true;
}
