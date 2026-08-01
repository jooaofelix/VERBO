import { afterEach, describe, expect, it, vi } from "vitest";
import { GEMINI_MODEL, runGeminiCompletion } from "./geminiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  properties: {
    resumo: { type: "string" },
    correcoes: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo: { type: "string", enum: ["ortografia", "concordancia"] } },
      },
    },
  },
};

describe("runGeminiCompletion", () => {
  it("posts to the expected Gemini endpoint with the key, schema, and system instruction split out", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"resumo":"ok"}' }] } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGeminiCompletion(
      "fake-key",
      [
        { role: "system", content: "Você é um revisor." },
        { role: "user", content: "Revise esta letra." },
      ],
      800,
      0.1,
      SCHEMA
    );

    expect(result).toEqual({ text: '{"resumo":"ok"}' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=fake-key`);
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Você é um revisor.");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Revise esta letra." }] }]);
    expect(body.generationConfig.temperature).toBe(0.1);
    expect(body.generationConfig.maxOutputTokens).toBe(800);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("converts the schema's type values to uppercase and strips OpenAPI-only keywords", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await runGeminiCompletion("fake-key", [{ role: "user", content: "oi" }], 500, 0.2, SCHEMA);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const schema = body.generationConfig.responseSchema;

    expect(schema.type).toBe("OBJECT");
    expect(schema.properties.resumo.type).toBe("STRING");
    expect(schema.properties.correcoes.type).toBe("ARRAY");
    expect(schema.properties.correcoes.items.type).toBe("OBJECT");
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBeUndefined();
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }))
    );
    const result = await runGeminiCompletion("fake-key", [{ role: "user", content: "oi" }], 500, 0.2, SCHEMA);
    expect(result).toBeNull();
  });

  it("returns null when there are no candidates or usable text (e.g. blocked by safety filters)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "SAFETY" }] }) }))
    );
    const result = await runGeminiCompletion("fake-key", [{ role: "user", content: "oi" }], 500, 0.2, SCHEMA);
    expect(result).toBeNull();
  });

  it("returns null on a network error or timeout, never throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const result = await runGeminiCompletion("fake-key", [{ role: "user", content: "oi" }], 500, 0.2, SCHEMA);
    expect(result).toBeNull();
  });
});
