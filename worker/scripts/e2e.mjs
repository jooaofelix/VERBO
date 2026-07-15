// End-to-end smoke test against the local Firebase Auth + Firestore
// emulators together with a real `wrangler dev` instance of the Worker.
// Not part of the regular vitest run — it exercises real network calls
// across two separate local servers. Run via:
//   npm run test:e2e   (from the repo root)
//
// Covers the full flow now that there is no Cloud Functions layer: login,
// a client-side Firestore write (song + version), a call to the Worker's
// /analyze endpoint carrying a real Firebase ID token, and the client
// writing the analysis result back to Firestore itself.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const WORKER_PORT = 8788;
const WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`;
const PROJECT_ID = "demo-verbo-test";

const LYRICS =
  "Verso 1\nTu és fiel, mesmo quando eu não entendo\n\nRefrão\nTu és fiel, tu és fiel";

const CONTEXT = {
  theologicalTradition: "nao_selecionar",
  desiredChangeLevel: "refinar_mantendo_voz",
  bibleReferencesProvidedByUser: [],
  isChristian: true,
};

function log(step) {
  console.log(`✓ ${step}`);
}

async function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // worker not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("worker did not become healthy in time");
}

async function main() {
  const worker = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--port",
      String(WORKER_PORT),
      "--var",
      `FIREBASE_PROJECT_ID:${PROJECT_ID}`,
      "--var",
      "ALLOWED_ORIGIN:*",
    ],
    { cwd: new URL("..", import.meta.url), stdio: "inherit" }
  );

  const stopWorker = () => {
    if (!worker.killed) worker.kill("SIGTERM");
  };
  process.on("exit", stopWorker);

  try {
    await waitForHealth(WORKER_URL);
    log("worker: /health responded OK");

    const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT_ID });
    const auth = getAuth(app);
    const db = getFirestore(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);

    const alice = await createUserWithEmailAndPassword(auth, "alice@example.com", "senha123456");
    const idToken = await alice.user.getIdToken();
    log(`login: created and signed in as alice (${alice.user.uid})`);

    const songRef = await addDoc(collection(db, "users", alice.user.uid, "songs"), {
      title: "Minha primeira composição",
      userId: alice.user.uid,
      congregational: false,
      hasAudio: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const versionRef = await addDoc(
      collection(db, "users", alice.user.uid, "songs", songRef.id, "versions"),
      {
        versionName: "Versão 1",
        lyrics: LYRICS,
        sections: [],
        context: CONTEXT,
        userId: alice.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    log(`save: song ${songRef.id} and version ${versionRef.id} written to Firestore`);

    const analyzeRes = await fetch(`${WORKER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        lyrics: LYRICS,
        sections: [],
        context: CONTEXT,
        revisionMode: "completa",
        bibleTranslationPreference: "dominio_publico_almeida",
      }),
    });
    assert.equal(analyzeRes.status, 200, `expected 200 from /analyze, got ${analyzeRes.status}`);
    const analyzeBody = await analyzeRes.json();
    assert.equal(analyzeBody.mode, "demo", "expected demo mode without an AI binding locally");
    assert.ok(analyzeBody.result, "expected a result payload");
    log(`analyze: worker returned mode=${analyzeBody.mode}`);

    const analysisRef = doc(collection(db, "users", alice.user.uid, "songs", songRef.id, "analyses"));
    await setDoc(analysisRef, {
      versionId: versionRef.id,
      mode: analyzeBody.mode,
      result: analyzeBody.result,
      userId: alice.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(versionRef, {
      analysisStatus: "completed",
      currentAnalysisId: analysisRef.id,
      updatedAt: serverTimestamp(),
    });
    log("save: analysis result written directly by the client (Worker never touches Firestore)");

    const versionSnap = await getDoc(versionRef);
    assert.equal(versionSnap.data().currentAnalysisId, analysisRef.id);
    const analysisSnap = await getDoc(analysisRef);
    assert.ok(analysisSnap.exists(), "analysis document should exist");
    log("verify: version references the analysis, analysis is readable by its owner");

    const unauthRes = await fetch(`${WORKER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics: "x", context: {} }),
    });
    assert.equal(unauthRes.status, 401, "expected 401 without an Authorization header");
    log("verify: worker rejects unauthenticated requests");

    console.log("\nAll end-to-end checks passed.");
  } finally {
    stopWorker();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
