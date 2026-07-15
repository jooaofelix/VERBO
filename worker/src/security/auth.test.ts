import { beforeEach, describe, expect, it } from "vitest";
import {
  AuthError,
  extractBearerToken,
  resetSigningKeyCacheForTests,
  verifyFirebaseIdToken,
} from "./auth.js";

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

async function signToken(privateKey: CryptoKey, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "RS256", kid: KEY_ID, typ: "JWT" };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: "user-123",
    iat: now - 10,
    exp: now + 3600,
    auth_time: now - 10,
    email: "compositor@example.com",
    ...overrides,
  };
}

async function fakeJwksFetch(publicKey: CryptoKey): Promise<typeof fetch> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  const body = JSON.stringify({ keys: [{ ...jwk, kid: KEY_ID, alg: "RS256", use: "sig" }] });
  return (async () =>
    new Response(body, { headers: { "cache-control": "max-age=3600" } })) as unknown as typeof fetch;
}

describe("verifyFirebaseIdToken", () => {
  beforeEach(() => {
    resetSigningKeyCacheForTests();
  });

  it("accepts a validly signed, current token for the right project", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const token = await signToken(privateKey, validPayload());
    const fetchImpl = await fakeJwksFetch(publicKey);

    const result = await verifyFirebaseIdToken(token, PROJECT_ID, { fetchImpl });
    expect(result.uid).toBe("user-123");
    expect(result.email).toBe("compositor@example.com");
  });

  it("rejects a token signed with a key that doesn't match any published JWK", async () => {
    const { privateKey } = await generateKeyPair();
    const { publicKey: otherPublicKey } = await generateKeyPair();
    const token = await signToken(privateKey, validPayload());
    const fetchImpl = await fakeJwksFetch(otherPublicKey);

    await expect(verifyFirebaseIdToken(token, PROJECT_ID, { fetchImpl })).rejects.toThrow(AuthError);
  });

  it("rejects an expired token", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(privateKey, validPayload({ exp: now - 3600, iat: now - 7200 }));
    const fetchImpl = await fakeJwksFetch(publicKey);

    await expect(verifyFirebaseIdToken(token, PROJECT_ID, { fetchImpl })).rejects.toThrow(/expirado/);
  });

  it("rejects a token issued for a different Firebase project", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const token = await signToken(
      privateKey,
      validPayload({ aud: "another-project", iss: "https://securetoken.google.com/another-project" })
    );
    const fetchImpl = await fakeJwksFetch(publicKey);

    await expect(verifyFirebaseIdToken(token, PROJECT_ID, { fetchImpl })).rejects.toThrow(/[Aa]udiência|[Ee]missor/);
  });

  it("rejects a malformed token", async () => {
    await expect(verifyFirebaseIdToken("not-a-jwt", PROJECT_ID)).rejects.toThrow(AuthError);
  });

  it("rejects a token missing a subject claim", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const payload = validPayload();
    delete (payload as Record<string, unknown>).sub;
    const token = await signToken(privateKey, payload);
    const fetchImpl = await fakeJwksFetch(publicKey);

    await expect(verifyFirebaseIdToken(token, PROJECT_ID, { fetchImpl })).rejects.toThrow(AuthError);
  });
});

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Authorization header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("throws when the header is missing", () => {
    expect(() => extractBearerToken(null)).toThrow(AuthError);
  });

  it("throws when the header doesn't start with 'Bearer '", () => {
    expect(() => extractBearerToken("Basic abc123")).toThrow(AuthError);
  });
});
