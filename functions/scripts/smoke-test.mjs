// End-to-end smoke test against the full local Emulator Suite (auth,
// firestore, storage, functions). Not part of the regular vitest run — it
// exercises real network calls across four emulators together, which is
// slower and needs `firebase emulators:exec` wrapping it. Run via:
//   npm run test:e2e   (from the repo root)
//
// Covers exactly the manual test list from the migration brief: login,
// per-user isolation, autosave-style writes, file upload, and the
// analyzeLyrics Cloud Function — using real SDK calls, not mocks.

import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, getStorage, ref, uploadBytes } from "firebase/storage";

const app = initializeApp({
  apiKey: "demo-key",
  projectId: "demo-verbo-test",
  storageBucket: "demo-verbo-test.appspot.com",
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "us-central1");

connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "127.0.0.1", 8080);
connectStorageEmulator(storage, "127.0.0.1", 9199);
connectFunctionsEmulator(functions, "127.0.0.1", 5001);

function log(step) {
  console.log(`✓ ${step}`);
}

async function main() {
  // 1. Login (email/password sign-up counts as establishing an authenticated session)
  const alice = await createUserWithEmailAndPassword(auth, "alice@example.com", "senha123456");
  log(`login: created and signed in as alice (${alice.user.uid})`);

  // 2. Save: create a song + version as Alice via the client SDK (subject to firestore.rules)
  const songRef = await addDoc(collection(db, "users", alice.user.uid, "songs"), {
    title: "Minha primeira composição",
    userId: alice.user.uid,
    congregational: false,
    hasAudio: false,
    status: "active",
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const versionRef = await addDoc(
    collection(db, "users", alice.user.uid, "songs", songRef.id, "versions"),
    {
      versionName: "Versão 1",
      lyrics: "Verso 1\nTu és fiel, mesmo quando eu não entendo\n\nRefrão\nTu és fiel, tu és fiel",
      sections: [],
      context: { theologicalTradition: "nao_selecionar", desiredChangeLevel: "refinar_mantendo_voz", bibleReferencesProvidedByUser: [] },
      userId: alice.user.uid,
      status: "active",
      version: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  log(`save: song ${songRef.id} and version ${versionRef.id} written to Firestore`);

  // 3. Analyze: call the analyzeLyrics Cloud Function (runs in demo mode — no ANTHROPIC_API_KEY locally)
  const analyzeLyrics = httpsCallable(functions, "analyzeLyrics");
  const analyzeResult = await analyzeLyrics({ songId: songRef.id, versionId: versionRef.id });
  assert.equal(analyzeResult.data.mode, "demo", "expected demo mode without ANTHROPIC_API_KEY");
  assert.ok(analyzeResult.data.analysisId, "expected an analysisId back");
  log(`analyze: analyzeLyrics returned mode=${analyzeResult.data.mode}, analysisId=${analyzeResult.data.analysisId}`);

  const versionSnap = await getDoc(versionRef);
  assert.equal(versionSnap.data().currentAnalysisId, analyzeResult.data.analysisId);
  log("analyze: version doc updated with currentAnalysisId");

  const analysisSnap = await getDoc(
    doc(db, "users", alice.user.uid, "songs", songRef.id, "analyses", analyzeResult.data.analysisId)
  );
  assert.ok(analysisSnap.exists(), "analysis document should exist");
  log("analyze: analysis document readable by its owner");

  // 4. Upload: put a small file in Storage, then register its metadata via processUploadedFile
  const storagePath = `users/${alice.user.uid}/attachment/${Date.now()}-nota.txt`;
  await uploadBytes(ref(storage, storagePath), Buffer.from("anotação de ensaio"), {
    contentType: "text/plain",
  });
  const processUploadedFile = httpsCallable(functions, "processUploadedFile");
  const uploadResult = await processUploadedFile({
    storagePath,
    songId: songRef.id,
    kind: "attachment",
  });
  assert.ok(uploadResult.data.fileId, "expected a fileId back");
  log(`upload: file stored and metadata recorded as ${uploadResult.data.fileId}`);

  // 5. Isolation: a second user must not be able to read Alice's data, nor
  // analyze her version by guessing the songId/versionId.
  await signOut(auth);
  const bob = await createUserWithEmailAndPassword(auth, "bob@example.com", "outrasenha1");
  log(`login: created and signed in as bob (${bob.user.uid})`);

  let isolationHeld = false;
  try {
    await getDoc(doc(db, "users", alice.user.uid, "songs", songRef.id));
  } catch (err) {
    isolationHeld = err.code === "permission-denied";
  }
  assert.ok(isolationHeld, "bob must NOT be able to read alice's song");
  log("isolation: bob blocked from reading alice's song (permission-denied)");

  let functionIsolationHeld = false;
  try {
    await analyzeLyrics({ songId: songRef.id, versionId: versionRef.id });
  } catch (err) {
    functionIsolationHeld = err.code === "functions/not-found";
  }
  assert.ok(functionIsolationHeld, "bob must NOT be able to trigger analysis on alice's version");
  log("isolation: bob blocked from analyzing alice's version via the callable (not-found)");

  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
