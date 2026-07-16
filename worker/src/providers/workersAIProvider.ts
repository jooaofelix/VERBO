import { AIProducedAnalysisSchema, type AIProducedAnalysis, type RevisionMode } from "@verbo/shared";
import { buildSimplifiedUserPayload, buildUserPayload, SYSTEM_PROMPT, SYSTEM_PROMPT_RETRY } from "./prompt.js";
import { ANALYSIS_JSON_SCHEMA } from "./jsonSchema.js";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
import { parseWithRepair } from "./repair.js";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const TEMPERATURE = 0.15;
const RETRY_MAX_TOKENS = 900;

// Workers AI reports a request timeout either as numeric error code 3046 or
// 3007, or with "Request timeout" somewhere in the message, depending on
// which layer times out first.
const TIMEOUT_ERROR_CODES = ["3046", "3007"];

/**
 * Thrown when both the primary attempt and the single post-timeout retry
 * fail to come back in time. The HTTP layer maps this to a 504 with a
 * user-facing Portuguese message instead of a generic 500.
 */
export class AITimeoutError extends Error {
  constructor(
    message = "A análise demorou mais que o esperado. Tente novamente em alguns instantes ou use a revisão rápida."
  ) {
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

function maxTokensFor(revisionMode: RevisionMode): number {
  return revisionMode === "rapida" ? 900 : 1800;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Strips a leading/trailing markdown code fence if the model wrapped its
 * JSON in one despite instructions not to — cheap and harmless when there
 * isn't one.
 */
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
      // Some models add stray prose around the JSON despite instructions;
      // as a last resort, grab the outermost { ... } span.
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

export class WorkersAIProvider implements AIAnalysisProvider {
  readonly mode = "live" as const;

  constructor(private readonly ai: Ai) {}

  async analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis> {
    const maxTokens = maxTokensFor(input.request.revisionMode);
    const userPayload = buildUserPayload(
      input.request,
      input.sections,
      input.deterministicGrammar,
      input.prosody
    );

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPayload },
    ];

    let first: { parsed: unknown; text: string };
    try {
      first = await this.runModel(messages, maxTokens);
    } catch (err) {
      // A timeout on the first attempt skips the generic schema-repair
      // loop entirely (it would just make a second, equally slow call for
      // the wrong reason) and goes straight to the dedicated timeout retry.
      if (!isTimeoutError(err)) throw err;
      return this.retryAfterTimeout(input);
    }

    let lastRawText = first.text;

    return parseWithRepair<AIProducedAnalysis>(
      AIProducedAnalysisSchema,
      extractJson(first.parsed ?? first.text),
      async (_raw, errors) => {
        messages.push({ role: "assistant", content: lastRawText });
        messages.push({
          role: "user",
          content:
            `A resposta anterior não respeitou o schema exigido. Erros: ${errors}. ` +
            "Responda novamente com um único objeto JSON completo e corrigido, sem texto adicional.",
        });
        const retry = await this.runModel(messages, maxTokens);
        lastRawText = retry.text;
        return extractJson(retry.parsed ?? retry.text);
      }
    );
  }

  /**
   * The single allowed retry after a timeout: same model, a much shorter
   * prompt (lyrics kept in full, everything else trimmed), and a smaller
   * token budget. Any further failure — another timeout or a response that
   * still doesn't validate — becomes an AITimeoutError instead of chaining
   * into more slow calls.
   */
  private async retryAfterTimeout(input: LyricsAnalysisInput): Promise<AIProducedAnalysis> {
    const simplifiedPayload = buildSimplifiedUserPayload(input.request, input.sections);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT_RETRY },
      { role: "user", content: simplifiedPayload },
    ];

    let retry: { parsed: unknown; text: string };
    try {
      retry = await this.runModel(messages, RETRY_MAX_TOKENS);
    } catch (err) {
      throw isTimeoutError(err) ? new AITimeoutError() : err;
    }

    try {
      const result = AIProducedAnalysisSchema.safeParse(extractJson(retry.parsed ?? retry.text));
      if (!result.success) {
        throw new AITimeoutError();
      }
      return result.data;
    } catch (err) {
      // Any failure on the retry — malformed JSON or a schema mismatch —
      // is reported the same way as a second timeout: no further calls.
      throw err instanceof AITimeoutError ? err : new AITimeoutError();
    }
  }

  private async runModel(
    messages: ChatMessage[],
    maxTokens: number
  ): Promise<{ parsed: unknown; text: string }> {
    const result = (await this.ai.run(MODEL as never, {
      messages,
      response_format: {
        type: "json_schema",
        json_schema: ANALYSIS_JSON_SCHEMA,
      },
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
    } as never)) as { response?: unknown };

    const response = result.response;
    return {
      parsed: response && typeof response === "object" ? response : undefined,
      text: typeof response === "string" ? response : JSON.stringify(response ?? ""),
    };
  }
}
