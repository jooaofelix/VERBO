import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
// Optional fields absent from an AI response (or a demo fixture) end up as
// literal `undefined` in the JS object graph; without this, any one of them
// makes the entire Firestore write throw instead of just omitting that key.
db.settings({ ignoreUndefinedProperties: true });

// Lazy: resolving the default bucket touches project config that's only
// guaranteed present once a function actually executes inside the Functions
// runtime/emulator, not at module load time.
let cachedBucket: ReturnType<ReturnType<typeof getStorage>["bucket"]> | undefined;
export function getBucket() {
  if (!cachedBucket) {
    cachedBucket = getStorage().bucket();
  }
  return cachedBucket;
}
