/**
 * Verifies Firebase Authentication ID tokens without firebase-admin (which
 * needs Node APIs unavailable in the Workers runtime). This mirrors the
 * verification Firebase's own SDKs perform, using nothing but Web Crypto
 * and fetch — both available in Cloudflare Workers and in Node 18+, so the
 * same code runs unmodified in production and in tests.
 *
 * Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface VerifiedIdToken {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
}

interface FirebaseJwk {
  kid: string;
  [key: string]: unknown;
}

interface JwksCache {
  keys: FirebaseJwk[];
  fetchedAt: number;
  ttlMs: number;
}

let cache: JwksCache | null = null;

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToJson<T>(input: string): T {
  const bytes = base64UrlDecode(input);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function parseMaxAge(cacheControl: string | null): number | null {
  const match = cacheControl?.match(/max-age=(\d+)/);
  return match ? Number(match[1]) * 1000 : null;
}

async function getGoogleSigningKeys(fetchImpl: typeof fetch, now: number): Promise<FirebaseJwk[]> {
  if (cache && now - cache.fetchedAt < cache.ttlMs) {
    return cache.keys;
  }

  const res = await fetchImpl(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new AuthError(`Não foi possível obter as chaves públicas do Firebase (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { keys: FirebaseJwk[] };
  const ttlMs = parseMaxAge(res.headers.get("cache-control")) ?? DEFAULT_JWKS_TTL_MS;

  cache = { keys: body.keys, fetchedAt: now, ttlMs };
  return body.keys;
}

/** Exposed only for tests, to avoid depending on a real network call. */
export function resetSigningKeyCacheForTests(): void {
  cache = null;
}

export interface VerifyOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  options: VerifyOptions = {}
): Promise<VerifiedIdToken> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ? options.now() : Date.now();

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("Token mal formado.");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = base64UrlDecodeToJson<{ alg: string; kid: string }>(headerB64);
  const payload = base64UrlDecodeToJson<Record<string, unknown>>(payloadB64);

  if (header.alg !== "RS256") {
    throw new AuthError(`Algoritmo de assinatura não suportado: ${header.alg}.`);
  }

  const keys = await getGoogleSigningKeys(fetchImpl, now);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new AuthError("Nenhuma chave pública corresponde a este token (kid desconhecido).");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk as unknown as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
  if (!validSignature) {
    throw new AuthError("Assinatura do token inválida.");
  }

  const nowSeconds = now / 1000;
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  const authTime = Number(payload.auth_time);
  const sub = payload.sub;

  if (!Number.isFinite(exp) || exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new AuthError("Token expirado.");
  }
  if (!Number.isFinite(iat) || iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new AuthError("Token emitido no futuro.");
  }
  if (Number.isFinite(authTime) && authTime - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new AuthError("Horário de autenticação inválido.");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError("Emissor do token não corresponde a este projeto Firebase.");
  }
  if (payload.aud !== projectId) {
    throw new AuthError("Audiência do token não corresponde a este projeto Firebase.");
  }
  if (typeof sub !== "string" || sub.length === 0) {
    throw new AuthError("Token sem identificador de usuário (sub).");
  }

  return {
    uid: sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    claims: payload,
  };
}

export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AuthError("Cabeçalho Authorization ausente ou mal formado.");
  }
  return authorizationHeader.slice("Bearer ".length).trim();
}
