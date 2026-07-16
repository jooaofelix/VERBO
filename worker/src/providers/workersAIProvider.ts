import type { AIProducedAnalysis, AnalyzeRequest, SectionStatusValue, SongSection } from "@verbo/shared";
import {
  ALL_AREAS,
  areaDefaults,
  areaRetrySystemPrompt,
  areaRetryUserPayload,
  areaSchemaFor,
  areaSystemPrompt,
  areaUserPayload,
  areasForMode,
  coerceObject,
  congregacionalAreaDefaults,
  composicaoAreaDefaults,
  type Area,
  type AreaOutput,
  type BiblicalAreaOutput,
  type ComposicaoAreaOutput,
  type CongregacionalAreaOutput,
  type PortuguesAreaOutput,
} from "./areas.js";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
import {
  QUICK_SYSTEM_PROMPT,
  QUICK_SYSTEM_PROMPT_RETRY,
  QuickReviewSchema,
  quickRetryUserPayload,
  quickReviewToAIProducedAnalysis,
  quickUserPayload,
} from "./quickReview.js";

const MODEL = "@cf/meta/llama-3.2-3b-instruct";

const QUICK_TEMPERATURE = 0.1;
const QUICK_MAX_TOKENS = 500;
const QUICK_RETRY_MAX_TOKENS = 350;

const AREA_TEMPERATURE = 0.15;
const AREA_MAX_TOKENS_COMPLETA = 500;
const AREA_MAX_TOKENS_INDIVIDUAL = 650;
const AREA_RETRY_MAX_TOKENS = 350;

const UNAVAILABLE_MESSAGE = "Esta parte da análise demorou mais que o esperado. Tente novamente.";

// Workers AI reports a request timeout either as numeric error code 3046 or
// 3007, or with "Request timeout" somewhere in the message, depending on
// which layer times out first.
const TIMEOUT_ERROR_CODES = ["3046", "3007"];

/**
 * Thrown only for "revisão rápida": if its single call and single retry
 * both fail, there is no partial content to fall back to, so the HTTP layer
 * maps this to a 504 with a user-facing Portuguese message.
 */
export class AITimeoutError extends Error {
  constructor(message = "A análise demorou mais que o esperado. Tente novamente em alguns instantes.") {
    super(message);
    this.name = "AITimeoutError";
  }
}

function isTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    TIMEOUT_ERROR_CODES.some((code) => message.includes(code)) ||
    message.toLowerCase().includes("request timeout")
  );
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function extractJson(raw: unknown): unknown {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    const cleaned = stripCodeFence(raw);
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error("Resposta do modelo não é um JSON válido.");
    }
  }
  throw new Error("Resposta do modelo em formato inesperado.");
}

function baseAnalysis(request: AnalyzeRequest): AIProducedAnalysis {
  const composicao = composicaoAreaDefaults(request);
  const congregacional = congregacionalAreaDefaults(request);
  return {
    overview: composicao.overview,
    bibleReferences: [],
    biblicalContext: [],
    theologicalClaims: [],
    coherence: composicao.coherence,
    grammarFindings: [],
    compositionFindings: [],
    chorusAnalysis: composicao.chorusAnalysis,
    rhymeFindings: [],
    mood: composicao.mood,
    congregational: congregacional.congregational,
    composerQuestions: [],
    findings: [],
    limitations: [],
    disclaimers: [],
    sectionStatus: {},
  };
}

function applyAreaResult(base: AIProducedAnalysis, area: Area, output: AreaOutput): void {
  switch (area) {
    case "biblica_teologica": {
      const o = output as BiblicalAreaOutput;
      base.bibleReferences = o.bibleReferences;
      base.biblicalContext = o.biblicalContext;
      base.theologicalClaims = o.theologicalClaims;
      base.findings = [...base.findings, ...o.findings];
      return;
    }
    case "portugues": {
      const o = output as PortuguesAreaOutput;
      base.grammarFindings = o.grammarFindings;
      base.findings = [...base.findings, ...o.findings];
      return;
    }
    case "composicao": {
      const o = output as ComposicaoAreaOutput;
      base.overview = o.overview;
      base.coherence = o.coherence;
      base.compositionFindings = o.compositionFindings;
      base.chorusAnalysis = o.chorusAnalysis;
      base.rhymeFindings = o.rhymeFindings;
      base.mood = o.mood;
      base.findings = [...base.findings, ...o.findings];
      return;
    }
    case "congregacional": {
      const o = output as CongregacionalAreaOutput;
      base.congregational = o.congregational;
      base.findings = [...base.findings, ...o.findings];
      return;
    }
  }
}

export class WorkersAIProvider implements AIAnalysisProvider {
  readonly mode = "live" as const;

  constructor(private readonly ai: Ai) {}

  async analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis> {
    if (input.request.revisionMode === "rapida") {
      return this.runQuickReview(input.request, input.sections);
    }
    return this.runAreaBasedReview(input.request, input.sections);
  }

  // ---- revisão rápida: exactly one call, one retry, never partial (all-or-nothing) ----

  private async runQuickReview(request: AnalyzeRequest, sections: SongSection[]): Promise<AIProducedAnalysis> {
    console.log("analyze section start", { area: "rapida", attempt: 1 });
    try {
      const res = await this.runModel(
        [
          { role: "system", content: QUICK_SYSTEM_PROMPT },
          { role: "user", content: quickUserPayload(request, sections) },
        ],
        QUICK_MAX_TOKENS,
        QUICK_TEMPERATURE
      );
      const parsed = QuickReviewSchema.parse(extractJson(res.parsed ?? res.text));
      console.log("analyze section success", { area: "rapida", attempt: 1 });
      console.log("complete analysis success", { mode: "rapida" });
      return quickReviewToAIProducedAnalysis(parsed);
    } catch {
      console.log("analyze section timeout", { area: "rapida", attempt: 1 });
    }

    try {
      const res = await this.runModel(
        [
          { role: "system", content: QUICK_SYSTEM_PROMPT_RETRY },
          { role: "user", content: quickRetryUserPayload(sections) },
        ],
        QUICK_RETRY_MAX_TOKENS,
        QUICK_TEMPERATURE
      );
      const parsed = QuickReviewSchema.parse(extractJson(res.parsed ?? res.text));
      console.log("analyze section success", { area: "rapida", attempt: 2 });
      console.log("complete analysis success", { mode: "rapida" });
      return quickReviewToAIProducedAnalysis(parsed);
    } catch {
      console.log("analyze section timeout", { area: "rapida", attempt: 2 });
      throw new AITimeoutError();
    }
  }

  // ---- revisão completa (4 areas) and individual-area modes (1 area), both
  // tolerant of a single area failing without discarding the rest ----

  private async runAreaBasedReview(
    request: AnalyzeRequest,
    sections: SongSection[]
  ): Promise<AIProducedAnalysis> {
    const areas = areasForMode(request.revisionMode);
    const primaryMaxTokens =
      request.revisionMode === "completa" ? AREA_MAX_TOKENS_COMPLETA : AREA_MAX_TOKENS_INDIVIDUAL;

    const result = baseAnalysis(request);
    const sectionStatus: Record<string, SectionStatusValue> = {};

    // Run one area at a time (not in parallel) to keep load on Workers AI
    // predictable and make a single failing area easy to isolate.
    for (const area of areas) {
      const { status, data } = await this.runArea(area, request, sections, primaryMaxTokens);
      applyAreaResult(result, area, data);
      if (status === "indisponivel") {
        sectionStatus[area] = { status: "indisponivel", mensagem: UNAVAILABLE_MESSAGE };
      }
    }

    result.sectionStatus = sectionStatus;

    if (Object.keys(sectionStatus).length > 0) {
      console.log("complete analysis partial", { areasUnavailable: Object.keys(sectionStatus) });
    } else {
      console.log("complete analysis success", { areas });
    }

    return result;
  }

  private async runArea(
    area: Area,
    request: AnalyzeRequest,
    sections: SongSection[],
    maxTokens: number
  ): Promise<{ status: "ok" | "indisponivel"; data: AreaOutput }> {
    const schema = areaSchemaFor(area);
    const fallback = areaDefaults(area, request);

    console.log("analyze section start", { area, attempt: 1 });
    try {
      const res = await this.runModel(
        [
          { role: "system", content: areaSystemPrompt(area) },
          { role: "user", content: areaUserPayload(area, request, sections) },
        ],
        maxTokens,
        AREA_TEMPERATURE
      );
      const raw = extractJson(res.parsed ?? res.text);
      console.log("analyze section success", { area, attempt: 1 });
      return { status: "ok", data: coerceObject(schema, raw, fallback as Record<string, unknown>) as AreaOutput };
    } catch (err) {
      if (!isTimeoutError(err)) {
        console.error("analyze section error", {
          area,
          attempt: 1,
          message: err instanceof Error ? err.message : String(err),
        });
        return { status: "indisponivel", data: fallback };
      }
      console.log("analyze section timeout", { area, attempt: 1 });
    }

    // A retry is only attempted after a timeout, and only once, with a
    // smaller prompt and a smaller token budget — never the same full call.
    console.log("analyze section start", { area, attempt: 2 });
    try {
      const res = await this.runModel(
        [
          { role: "system", content: areaRetrySystemPrompt(area) },
          { role: "user", content: areaRetryUserPayload(area, sections) },
        ],
        AREA_RETRY_MAX_TOKENS,
        AREA_TEMPERATURE
      );
      const raw = extractJson(res.parsed ?? res.text);
      console.log("analyze section success", { area, attempt: 2 });
      return { status: "ok", data: coerceObject(schema, raw, fallback as Record<string, unknown>) as AreaOutput };
    } catch {
      console.log("analyze section timeout", { area, attempt: 2 });
      return { status: "indisponivel", data: fallback };
    }
  }

  private async runModel(
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<{ parsed: unknown; text: string }> {
    const result = (await this.ai.run(MODEL as never, {
      messages,
      // No JSON Schema is sent — short prose instructions in the prompt do
      // the formatting job, and the result is validated locally afterwards.
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature,
    } as never)) as { response?: unknown };

    const response = result.response;
    return {
      parsed: response && typeof response === "object" ? response : undefined,
      text: typeof response === "string" ? response : JSON.stringify(response ?? ""),
    };
  }
}

// Re-exported so callers/tests can enumerate areas without importing
// ./areas.js directly.
export { ALL_AREAS };
