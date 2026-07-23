import { AnalysisResultSchema, type AnalyzeRequest } from "@verbo/shared";
import { describe, expect, it, vi } from "vitest";
import { runAnalysis } from "./analysisService.js";

const runLanguageToolCheckMock = vi.fn().mockResolvedValue([]);
vi.mock("./grammar/languageTool.js", () => ({
  runLanguageToolCheck: (...args: unknown[]) => runLanguageToolCheckMock(...args),
}));

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

describe("runAnalysis — LanguageTool findings", () => {
  it("adds a LanguageTool finding whose excerpt doesn't overlap with an existing one", async () => {
    runLanguageToolCheckMock.mockResolvedValueOnce([
      {
        id: "lt-test-1",
        originalExcerpt: "um trecho totalmente único",
        type: "concordancia_verbal",
        explanation: "Explicação detalhada do LanguageTool.",
        possibleCorrection: "correção sugerida",
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "languagetool",
      },
    ]);

    const { result } = await runAnalysis(request(), undefined);
    expect(result.grammarFindings.some((f) => f.source === "languagetool")).toBe(true);
  });

  it("skips a LanguageTool finding that duplicates an excerpt already flagged deterministically", async () => {
    // The fixture lyrics contain a double space ("escuros  buscando"), which
    // runDeterministicChecks always flags with originalExcerpt "s  b".
    runLanguageToolCheckMock.mockResolvedValueOnce([
      {
        id: "lt-test-2",
        originalExcerpt: "s  b",
        type: "pontuacao",
        explanation: "Duplicata do achado determinístico.",
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "languagetool",
      },
    ]);

    const { result } = await runAnalysis(request(), undefined);
    expect(result.grammarFindings.filter((f) => f.source === "languagetool")).toHaveLength(0);
  });

  it("never drops the deterministic/AI findings even when LanguageTool itself fails", async () => {
    runLanguageToolCheckMock.mockRejectedValueOnce(new Error("languagetool unavailable"));
    const { result } = await runAnalysis(request(), undefined);
    expect(result.grammarFindings.some((f) => f.source === "deterministico")).toBe(true);
  });
});
