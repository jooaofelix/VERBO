import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index.js";
import { resetSigningKeyCacheForTests } from "./security/auth.js";
import { resetRateLimitForTests } from "./security/rateLimit.js";

const PROJECT_ID = "verbo-cancao-free";
const KEY_ID = "test-key-1";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  ) as Promise<CryptoKeyPair>;
}

async function signToken(privateKey: CryptoKey, uid: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: KEY_ID, typ: "JWT" };
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: uid,
    iat: now - 10,
    exp: now + 3600,
    auth_time: now - 10,
  };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

const env: Env = {
  AI: undefined,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  ALLOWED_ORIGIN: "https://verbo-cancao.pages.dev",
};

let keyPair: CryptoKeyPair;
let token: string;

beforeEach(async () => {
  resetSigningKeyCacheForTests();
  resetRateLimitForTests();
  keyPair = await generateKeyPair();
  token = await signToken(keyPair.privateKey, "user-abc");

  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const jwksBody = JSON.stringify({ keys: [{ ...jwk, kid: KEY_ID, alg: "RS256", use: "sig" }] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(jwksBody, { headers: { "cache-control": "max-age=3600" } }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("worker fetch handler", () => {
  it("responds to /health without requiring auth", async () => {
    const res = await worker.fetch(new Request("https://worker.example/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGIN);
  });

  it("answers CORS preflight requests", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example/analyze", { method: "OPTIONS" }),
      env
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("rejects /analyze without an Authorization header", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example/analyze", { method: "POST", body: "{}" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("rejects /analyze with a token signed by an unknown key", async () => {
    const { privateKey } = await generateKeyPair();
    const badToken = await signToken(privateKey, "user-xyz");
    const res = await worker.fetch(
      new Request("https://worker.example/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${badToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: "Tu és fiel", context: {} }),
      }),
      env
    );
    // Signed with a different key than what our mocked JWKS serves for this test's own token.
    expect(res.status).toBe(401);
  });

  it("runs a full analysis in demo mode when a valid token is presented and no AI binding is set", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: "Verso 1\nTu és fiel\n\nRefrão\nTu és fiel, tu és fiel", context: {} }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; result: { overview: { perceivedCentralMessage: string } } };
    expect(body.mode).toBe("demo");
    expect(body.result.overview.perceivedCentralMessage).toBeTruthy();
  });

  it("rejects an empty lyrics body with 400", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: "", context: {} }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("suggests sections given raw lyrics", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example/sections/suggest", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: "Verso 1\nUma linha\n\nRefrão\nOutra linha" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sections: unknown[] };
    expect(body.sections.length).toBeGreaterThan(0);
  });

  it("enforces the per-user rate limit on /analyze", async () => {
    const makeRequest = () =>
      worker.fetch(
        new Request("https://worker.example/analyze", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ lyrics: "Tu és fiel", context: {} }),
        }),
        env
      );

    for (let i = 0; i < 30; i++) {
      const res = await makeRequest();
      expect(res.status).toBe(200);
    }
    const limited = await makeRequest();
    expect(limited.status).toBe(429);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await worker.fetch(new Request("https://worker.example/nope"), env);
    expect(res.status).toBe(404);
  });
});
