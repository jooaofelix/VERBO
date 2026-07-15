import { AIProducedAnalysisSchema } from "@verbo/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Plain JSON Schema (no $ref/definitions indirection) describing exactly
 * what the model must return. Passed as `response_format.json_schema` to
 * Workers AI's JSON mode, and also inlined into the prompt as a fallback
 * for models/situations where structured output enforcement isn't honored.
 */
export const ANALYSIS_JSON_SCHEMA = zodToJsonSchema(AIProducedAnalysisSchema, {
  target: "openApi3",
  $refStrategy: "none",
});
