import type { AIProducedAnalysis, AnalyzeRequest, SectionStatusValue, SongSection } from "@verbo/shared";
import {
  AREA_SYSTEM_PROMPT,
  AREA_SYSTEM_PROMPT_RETRY,
  ALL_AREAS,
  areaAISchemaFor,
  areaEmptyShape,
  areaJsonSchema,
  areaRetryUserPayload,
  areaUserPayload,
  areasForMode,
  applyAreaAliases,
  coerceObject,
  extractJson,
  mergeAreasIntoAnalysis,
  type Area,
  type AreaAIShape,
  type AreaShapes,
} from "./areas.js";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
import {
  QUICK_JSON_SCHEMA,
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

const TIMEOUT_MESSAGE = "Esta parte da análise demorou mais que o esperado. Tente novamente.";
const FORMAT_INVALID_MESSAGE = "A resposta desta seção não pôde ser processada.";
const GENERIC_UNAVAILABLE_MESSAGE = "Não foi possível concluir esta parte da análise agora. Tente novamente.";

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

type AttemptOutcome =
  | { kind: "ok"; data: AreaAIShape }
  | { kind: "timeout" }
  | { kind: "formato_invalido" }
  | { kind: "erro" };

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
        QUICK_TEMPERATURE,
        QUICK_JSON_SCHEMA
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
        QUICK_TEMPERATURE,
        QUICK_JSON_SCHEMA
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

    const shapes: AreaShapes = {};
    const sectionStatus: Record<string, SectionStatusValue> = {};

    // Run one area at a time (not in parallel) to keep load on Workers AI
    // predictable and make a single failing area easy to isolate.
    for (const area of areas) {
      const { status, data } = await this.runArea(area, request, sections, primaryMaxTokens);
      (shapes as Record<Area, AreaAIShape>)[area] = data;
      if (status !== "ok") {
        sectionStatus[area] = { status, mensagem: messageForStatus(status) };
      }
    }

    const result = mergeAreasIntoAnalysis(request, shapes);
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
  ): Promise<{ status: "ok" | "timeout" | "formato_invalido" | "indisponivel"; data: AreaAIShape }> {
    console.log("analyze section start", { area, attempt: 1 });
    const first = await this.attemptArea(
      area,
      [
        { role: "system", content: AREA_SYSTEM_PROMPT },
        { role: "user", content: areaUserPayload(area, request, sections) },
      ],
      maxTokens
    );
    if (first.kind === "ok") {
      console.log("analyze section success", { area, attempt: 1 });
      return { status: "ok", data: first.data };
    }
    console.log(logLabelFor(first.kind), { area, attempt: 1, kind: first.kind });

    // Exactly one retry, regardless of why the first attempt failed — never
    // the same full call again, always the smaller prompt/budget below.
    console.log("analyze section start", { area, attempt: 2 });
    const retry = await this.attemptArea(
      area,
      [
        { role: "system", content: AREA_SYSTEM_PROMPT_RETRY },
        { role: "user", content: areaRetryUserPayload(area, sections) },
      ],
      AREA_RETRY_MAX_TOKENS
    );
    if (retry.kind === "ok") {
      console.log("analyze section success", { area, attempt: 2 });
      return { status: "ok", data: retry.data };
    }
    console.log(logLabelFor(retry.kind), { area, attempt: 2, kind: retry.kind });

    const status = retry.kind === "erro" ? "indisponivel" : retry.kind;
    return { status, data: areaEmptyShape(area) };
  }

  /** Runs one model call for an area and classifies the outcome — never throws. */
  private async attemptArea(area: Area, messages: ChatMessage[], maxTokens: number): Promise<AttemptOutcome> {
    let res: { parsed: unknown; text: string };
    try {
      res = await this.runModel(messages, maxTokens, AREA_TEMPERATURE, areaJsonSchema(area));
    } catch (err) {
      return isTimeoutError(err) ? { kind: "timeout" } : { kind: "erro" };
    }

    let extracted: unknown;
    try {
      extracted = extractJson(res.parsed ?? res.text);
    } catch {
      return { kind: "formato_invalido" };
    }

    const schema = areaAISchemaFor(area);
    const aliased = applyAreaAliases(extracted, area);
    const coerced = coerceObject(schema, aliased, areaEmptyShape(area) as Record<string, unknown>);
    return { kind: "ok", data: coerced as AreaAIShape };
  }

  private async runModel(
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number,
    jsonSchema: unknown
  ): Promise<{ parsed: unknown; text: string }> {
    const result = (await this.ai.run(MODEL as never, {
      messages,
      // A small, area-specific JSON Schema — never the whole AnalysisResult
      // schema — drives Workers AI's native structured-output mode.
      response_format: { type: "json_schema", json_schema: jsonSchema },
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

function messageForStatus(status: "timeout" | "formato_invalido" | "indisponivel"): string {
  switch (status) {
    case "timeout":
      return TIMEOUT_MESSAGE;
    case "formato_invalido":
      return FORMAT_INVALID_MESSAGE;
    case "indisponivel":
      return GENERIC_UNAVAILABLE_MESSAGE;
  }
}

function logLabelFor(kind: "timeout" | "formato_invalido" | "erro"): string {
  switch (kind) {
    case "timeout":
      return "analyze section timeout";
    case "formato_invalido":
      return "analyze section format-invalid";
    case "erro":
      return "analyze section error";
  }
}

// Re-exported so callers/tests can enumerate areas without importing
// ./areas.js directly.
export { ALL_AREAS };
