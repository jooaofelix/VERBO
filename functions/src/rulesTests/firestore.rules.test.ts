import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "verbo-e-cancao-test",
    firestore: {
      rules: readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const ALICE = "alice-uid";
const BOB = "bob-uid";

function aliceDb() {
  return testEnv.authenticatedContext(ALICE).firestore();
}

function bobDb() {
  return testEnv.authenticatedContext(BOB).firestore();
}

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedAsAlice(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(path).set(data);
  });
}

describe("firestore.rules — users/{userId} profile", () => {
  it("lets a signed-in user create their own profile", async () => {
    const db = aliceDb();
    await assertSucceeds(
      db
        .doc(`users/${ALICE}`)
        .set({ createdAt: new Date(), updatedAt: new Date(), isAnonymous: false })
    );
  });

  it("blocks an unauthenticated request from creating any profile", async () => {
    const db = anonDb();
    await assertFails(
      db
        .doc(`users/${ALICE}`)
        .set({ createdAt: new Date(), updatedAt: new Date(), isAnonymous: false })
    );
  });

  it("blocks a user from reading someone else's profile", async () => {
    await seedAsAlice(`users/${ALICE}`, {
      createdAt: new Date(),
      updatedAt: new Date(),
      isAnonymous: false,
    });
    await assertFails(bobDb().doc(`users/${ALICE}`).get());
  });

  it("blocks a user from creating a profile under another user's uid", async () => {
    const db = bobDb();
    await assertFails(
      db
        .doc(`users/${ALICE}`)
        .set({ createdAt: new Date(), updatedAt: new Date(), isAnonymous: false })
    );
  });
});

describe("firestore.rules — songs", () => {
  it("lets the owner create a song with matching userId", async () => {
    const db = aliceDb();
    await assertSucceeds(
      db.collection(`users/${ALICE}/songs`).add({
        title: "Minha canção",
        userId: ALICE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });

  it("blocks creating a song with a spoofed userId", async () => {
    const db = aliceDb();
    await assertFails(
      db.collection(`users/${ALICE}/songs`).add({
        title: "Minha canção",
        userId: BOB,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });

  it("blocks another user from reading Alice's songs", async () => {
    await seedAsAlice(`users/${ALICE}/songs/song1`, {
      title: "Privada",
      userId: ALICE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertFails(bobDb().doc(`users/${ALICE}/songs/song1`).get());
    await assertSucceeds(aliceDb().doc(`users/${ALICE}/songs/song1`).get());
  });

  it("blocks a title beyond the size limit", async () => {
    const db = aliceDb();
    await assertFails(
      db.collection(`users/${ALICE}/songs`).add({
        title: "x".repeat(301),
        userId: ALICE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });
});

describe("firestore.rules — versions", () => {
  it("blocks lyrics beyond the 20000-character limit", async () => {
    const db = aliceDb();
    await assertFails(
      db.collection(`users/${ALICE}/songs/song1/versions`).add({
        lyrics: "a".repeat(20001),
        userId: ALICE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });

  it("allows lyrics within the size limit", async () => {
    const db = aliceDb();
    await assertSucceeds(
      db.collection(`users/${ALICE}/songs/song1/versions`).add({
        lyrics: "Tu és fiel",
        userId: ALICE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });
});

describe("firestore.rules — server-only collections", () => {
  it("blocks the owner from writing directly to analyses (Cloud Functions only)", async () => {
    const db = aliceDb();
    await assertFails(
      db.doc(`users/${ALICE}/songs/song1/analyses/a1`).set({ result: {}, userId: ALICE })
    );
  });

  it("still lets the owner read an analysis written by the server", async () => {
    await seedAsAlice(`users/${ALICE}/songs/song1/analyses/a1`, { result: {}, userId: ALICE });
    await assertSucceeds(aliceDb().doc(`users/${ALICE}/songs/song1/analyses/a1`).get());
    await assertFails(bobDb().doc(`users/${ALICE}/songs/song1/analyses/a1`).get());
  });

  it("blocks the owner from writing directly to reports (Cloud Functions only)", async () => {
    const db = aliceDb();
    await assertFails(db.doc(`users/${ALICE}/reports/r1`).set({ report: {}, userId: ALICE }));
  });

  it("blocks the owner from tampering with their own rate-limit counter", async () => {
    const db = aliceDb();
    await assertFails(
      db.doc(`users/${ALICE}/settings/rateLimit_analyzeLyrics`).set({ count: 0 })
    );
  });

  it("still allows normal settings documents to be written by the owner", async () => {
    const db = aliceDb();
    await assertSucceeds(db.doc(`users/${ALICE}/settings/preferences`).set({ theme: "dark" }));
  });
});

describe("firestore.rules — default deny", () => {
  it("denies access to any path outside the users/{uid} structure", async () => {
    await assertFails(aliceDb().doc("public/announcement").get());
  });
});
