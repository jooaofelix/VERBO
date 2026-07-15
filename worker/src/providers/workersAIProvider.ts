import { AIProducedAnalysisSchema, type AIProducedAnalysis } from "@verbo/shared";
import { buildUserPayload, SYSTEM_PROMPT } from "./prompt.js";
import { ANALYSIS_JSON_SCHEMA } from "./jsonSchema.js";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
import { parseWithRepair } from "./repair.js";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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

    const first = await this.runModel(messages);
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
        const retry = await this.runModel(messages);
        lastRawText = retry.text;
        return extractJson(retry.parsed ?? retry.text);
      }
    );
  }

  private async runModel(
    messages: ChatMessage[]
  ): Promise<{ parsed: unknown; text: string }> {
    const result = (await this.ai.run(MODEL as never, {
      messages,
      response_format: {
        type: "json_schema",
        json_schema: ANALYSIS_JSON_SCHEMA,
      },
      max_tokens: 4096,
    } as never)) as { response?: unknown };

    const response = result.response;
    return {
      parsed: response && typeof response === "object" ? response : undefined,
      text: typeof response === "string" ? response : JSON.stringify(response ?? ""),
    };
  }
}
