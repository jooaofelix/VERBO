import Anthropic from "@anthropic-ai/sdk";
import { AIProducedAnalysisSchema, type AIProducedAnalysis } from "@verbo/shared";
import { env } from "../env.js";
import { buildUserPayload, SYSTEM_PROMPT } from "./prompt.js";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
import { parseWithRepair } from "./repair.js";
import { SUBMIT_ANALYSIS_TOOL } from "./toolSchema.js";

const TOOL_NAME = "submit_analysis";

function extractToolUse(message: Anthropic.Messages.Message) {
  const block = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
  );
  if (!block) {
    throw new Error("O modelo não retornou a chamada de ferramenta esperada (submit_analysis).");
  }
  return block;
}

export class AnthropicAIProvider implements AIAnalysisProvider {
  readonly mode = "live" as const;
  private client: Anthropic;

  constructor(apiKey: string = env.anthropicApiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis> {
    const userPayload = buildUserPayload(
      input.request,
      input.sections,
      input.deterministicGrammar,
      input.prosody
    );

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userPayload },
    ];

    const first = await this.client.messages.create({
      model: env.anthropicModel,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages,
    });

    let toolUseBlock = extractToolUse(first);

    return parseWithRepair<AIProducedAnalysis>(
      AIProducedAnalysisSchema,
      toolUseBlock.input,
      async (_raw, errors) => {
        messages.push({ role: "assistant", content: first.content });
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              is_error: true,
              content: `A resposta não respeitou o schema exigido. Erros: ${errors}. ` +
                `Chame novamente "${TOOL_NAME}" com um objeto JSON completo e corrigido.`,
            },
          ],
        });

        const retry = await this.client.messages.create({
          model: env.anthropicModel,
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: [SUBMIT_ANALYSIS_TOOL],
          tool_choice: { type: "tool", name: TOOL_NAME },
          messages,
        });

        toolUseBlock = extractToolUse(retry);
        return toolUseBlock.input;
      }
    );
  }
}
