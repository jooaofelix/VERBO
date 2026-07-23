import { AnalyzeRequestSchema } from "@verbo/shared";
import { z } from "zod";
import { AITimeoutError } from "./providers/workersAIProvider.js";
import { extractBearerToken, verifyFirebaseIdToken, AuthError } from "./security/auth.js";
import { isWithinRateLimit } from "./security/rateLimit.js";
import { assertLyricsSizeWithinLimit, ValidationError } from "./security/validation.js";
import { runAnalysis } from "./services/analysisService.js";
import { suggestSections } from "./services/grammar/sectionSplitter.js";
import { summarizeForLog } from "./services/safeLog.js";

export interface Env {
  AI?: Ai;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  /** Optional free API token for abibliadigital.com.br (register at the site to get one). Verse lookups outside the curated dataset simply stay unavailable when this isn't set. */
  ABIBLIADIGITAL_TOKEN?: string;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function requireAuth(request: Request, env: Env): Promise<{ uid: string }> {
  const token = extractBearerToken(request.headers.get("Authorization"));
  return verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
}

const SuggestSectionsRequestSchema = z.object({ lyrics: z.string().min(1) });

async function handleAnalyze(request: Request, env: Env, origin: string): Promise<Response> {
  const { uid } = await requireAuth(request, env);

  if (!isWithinRateLimit(`analyze:${uid}`, 30)) {
    return json(
      { error: "Limite de análises por hora atingido. Tente novamente mais tarde." },
      429,
      origin
    );
  }

  const body = AnalyzeRequestSchema.parse(await request.json());
  assertLyricsSizeWithinLimit(body.lyrics);

  console.log("analyze request", { uid, ...summarizeForLog(body) });

  const { mode, result } = await runAnalysis(body, env.AI, env.ABIBLIADIGITAL_TOKEN);
  return json({ mode, result }, 200, origin);
}

async function handleSuggestSections(request: Request, env: Env, origin: string): Promise<Response> {
  const { uid } = await requireAuth(request, env);

  if (!isWithinRateLimit(`suggest:${uid}`, 60)) {
    return json({ error: "Limite de chamadas por hora atingido." }, 429, origin);
  }

  const body = SuggestSectionsRequestSchema.parse(await request.json());
  assertLyricsSizeWithinLimit(body.lyrics);

  return json({ sections: suggestSections(body.lyrics) }, 200, origin);
}

function handleHealth(env: Env, origin: string): Response {
  return json({ ok: true, aiBindingAvailable: Boolean(env.AI) }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return handleHealth(env, origin);
      }
      if (url.pathname === "/analyze" && request.method === "POST") {
        return await handleAnalyze(request, env, origin);
      }
      if (url.pathname === "/sections/suggest" && request.method === "POST") {
        return await handleSuggestSections(request, env, origin);
      }
      return json({ error: "Rota não encontrada." }, 404, origin);
    } catch (err) {
      if (err instanceof AuthError) {
        return json({ error: err.message }, 401, origin);
      }
      if (err instanceof ValidationError) {
        return json({ error: err.message }, 400, origin);
      }
      if (err instanceof z.ZodError) {
        return json(
          {
            error: "Requisição inválida.",
            details: err.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`),
          },
          400,
          origin
        );
      }
      if (err instanceof AITimeoutError) {
        return json({ error: err.message }, 504, origin);
      }
      console.error("Erro inesperado:", err instanceof Error ? err.message : err);
      return json({ error: "Erro inesperado ao processar a requisição." }, 500, origin);
    }
  },
};
