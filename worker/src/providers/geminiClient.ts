const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// Fast/cheap Gemini model, used only for the two areas the user specifically
// asked to strengthen (português and referência bíblica). Kept as a single
// constant so it's trivial to swap after real-world verification.
export const GEMINI_MODEL = "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 15000;

export interface GeminiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Converts our zod-to-json-schema (openApi3 target) output into the subset
 * Gemini's `responseSchema` accepts: the same shape, but with `type` values
 * uppercased ("OBJECT", "STRING", "ARRAY", ...) and a few OpenAPI-only
 * keywords Gemini doesn't understand stripped out. $ref never appears since
 * the schemas are already generated with $refStrategy: "none".
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;

  const source = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema" || key === "additionalProperties" || key === "definitions" || key === "$ref") {
      continue;
    }
    if (key === "type" && typeof value === "string") {
      result.type = value.toUpperCase();
      continue;
    }
    result[key] = toGeminiSchema(value);
  }

  return result;
}

export interface GeminiResult {
  text: string;
}

/**
 * Calls the Gemini API for one structured-output completion. Fails soft —
 * returns null on any network error, timeout, non-2xx response, or a
 * response Gemini itself didn't complete (blocked by safety filters, no
 * candidates, empty text) — callers fall back to the existing Workers AI
 * retry rather than surfacing a Gemini-specific error to the user.
 */
export async function runGeminiCompletion(
  apiKey: string,
  messages: GeminiChatMessage[],
  maxOutputTokens: number,
  temperature: number,
  jsonSchema: unknown
): Promise<GeminiResult | null> {
  const systemMessage = messages.find((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: conversation.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(jsonSchema),
        },
      }),
    });

    if (!response.ok) {
      console.log("gemini call failed", { status: response.status });
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      console.log("gemini call returned no usable text", { finishReason: data.candidates?.[0]?.finishReason });
      return null;
    }

    return { text };
  } catch (err) {
    console.log("gemini call error", { message: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
