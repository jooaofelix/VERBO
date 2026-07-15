import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { firebaseApp } from "./app.js";

function createFirestore() {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Offline persistence isn't available in every environment (e.g. some
    // private-browsing modes, or a second call after Firestore was already
    // initialized elsewhere). Fall back to the default in-memory client
    // rather than breaking the app.
    return getFirestore(firebaseApp);
  }
}

export const db = createFirestore();
