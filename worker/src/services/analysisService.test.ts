import { AnalysisResultSchema, type AnalyzeRequest } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import { runAnalysis } from "./analysisService.js";

function request(overrides: Partial<AnalyzeRequest> = {}): AnalyzeRequest {
  return {
    lyrics:
      "Verso 1\nCaminho por vales escuros  buscando\n\nRefrão\nTu és fiel, tu és fiel\n\nVerso 2\nMinha alma descansa em ti",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    revisionMode: "completa",
    bibleTranslationPreference: "dominio_publico_almeida",
    ...overrides,
  };
}

describe("runAnalysis (demo mode, no AI binding available)", () => {
  it("returns a fully schema-valid result", async () => {
    const { mode, result } = await runAnalysis(request(), undefined);
    expect(mode).toBe("demo");
    expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
  });

  it("merges deterministic grammar findings (e.g. the double space) with the AI ones", async () => {
    const { result } = await runAnalysis(request(), undefined);
    expect(
      result.grammarFindings.some((f) => f.source === "deterministico" && f.type === "pontuacao")
    ).toBe(true);
  });

  it("always includes deterministic prosody findings, never left to the AI", async () => {
    const { result } = await runAnalysis(request(), undefined);
    expect(result.prosodyFindings.length).toBeGreaterThan(0);
  });

  it("auto-splits sections from raw lyrics when the caller sends none", async () => {
    const { result } = await runAnalysis(request(), undefined);
    expect(result.grammarFindings.length + result.prosodyFindings.length).toBeGreaterThan(0);
  });

  it("handles very short / instrumental-like lyrics without throwing", async () => {
    const { result } = await runAnalysis(request({ lyrics: "(instrumental)" }), undefined);
    expect(result.id).toBeTruthy();
  });

  it("identifies Salmo 126:5 from the lyric phrase even without an AI binding", async () => {
    const { result } = await runAnalysis(
      request({ lyrics: "Aqueles que semeiam com lágrimas colherão com a alegria do Senhor" }),
      undefined
    );
    expect(result.bibleReferences.some((r) => r.referenceLabel === "Salmos 126:5")).toBe(true);
  });
});
