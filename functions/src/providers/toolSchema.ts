import type Anthropic from "@anthropic-ai/sdk";
import { AIProducedAnalysisSchema } from "@verbo/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

const jsonSchema = zodToJsonSchema(AIProducedAnalysisSchema, {
  target: "openApi3",
  $refStrategy: "none",
});

// Anthropic's tool input_schema wants a plain JSON Schema object, not the
// wrapper zod-to-json-schema adds when a $ref/definitions structure is used.
// With $refStrategy "none" everything is already inlined.
export const SUBMIT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description:
    "Envia a análise estruturada completa da letra, respeitando exatamente o schema informado.",
  input_schema: jsonSchema as unknown as Anthropic.Tool.InputSchema,
};
