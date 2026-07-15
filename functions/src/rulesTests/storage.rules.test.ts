import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const ALICE = "alice-uid";
const BOB = "bob-uid";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "verbo-e-cancao-test",
    storage: {
      rules: readFileSync(new URL("../../../storage.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

function aliceStorage() {
  return testEnv.authenticatedContext(ALICE).storage();
}

function bobStorage() {
  return testEnv.authenticatedContext(BOB).storage();
}

function anonStorage() {
  return testEnv.unauthenticatedContext().storage();
}

const smallBuffer = Buffer.from("conteúdo de teste");
const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024, 1);

describe("storage.rules", () => {
  it("lets the owner upload an allowed file type under their own prefix", async () => {
    await assertSucceeds(
      aliceStorage().ref(`users/${ALICE}/pdf/relatorio.pdf`).put(smallBuffer, {
        contentType: "application/pdf",
      })
    );
  });

  it("blocks a disallowed content type", async () => {
    await assertFails(
      aliceStorage().ref(`users/${ALICE}/attachment/malicious.exe`).put(smallBuffer, {
        contentType: "application/x-msdownload",
      })
    );
  });

  it("blocks a file over the size limit", async () => {
    await assertFails(
      aliceStorage().ref(`users/${ALICE}/audio/big.mp3`).put(oversizedBuffer, {
        contentType: "audio/mpeg",
      })
    );
  });

  it("blocks writing under another user's prefix", async () => {
    await assertFails(
      bobStorage().ref(`users/${ALICE}/pdf/relatorio.pdf`).put(smallBuffer, {
        contentType: "application/pdf",
      })
    );
  });

  it("blocks an unauthenticated upload entirely", async () => {
    await assertFails(
      anonStorage().ref(`users/${ALICE}/pdf/relatorio.pdf`).put(smallBuffer, {
        contentType: "application/pdf",
      })
    );
  });

  it("blocks another user from reading a file that isn't theirs", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.storage().ref(`users/${ALICE}/pdf/relatorio.pdf`).put(smallBuffer, {
        contentType: "application/pdf",
      });
    });
    await assertFails(bobStorage().ref(`users/${ALICE}/pdf/relatorio.pdf`).getDownloadURL());
    await assertSucceeds(aliceStorage().ref(`users/${ALICE}/pdf/relatorio.pdf`).getDownloadURL());
  });
});
