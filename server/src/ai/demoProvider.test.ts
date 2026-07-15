import { AIProducedAnalysisSchema, type AnalyzeRequest, type SongSection } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import { DemoAIProvider } from "./demoProvider.js";

function baseRequest(): AnalyzeRequest {
  return {
    lyrics: "Tu és fiel\n\nTu és fiel, tu és fiel",
    sections: [],
    context: { theologicalTradition: "nao_selecionar", desiredChangeLevel: "refinar_mantendo_voz", bibleReferencesProvidedByUser: [] },
    revisionMode: "completa",
    bibleTranslationPreference: "dominio_publico_almeida",
  };
}

function sections(): SongSection[] {
  return [
    { id: "sec-1", type: "verso", index: 1, label: "Verso 1", text: "Tu és fiel", startLine: 0, endLine: 0 },
    { id: "sec-2", type: "refrao", label: "Refrão", text: "Tu és fiel, tu és fiel", startLine: 2, endLine: 2 },
  ];
}

describe("DemoAIProvider", () => {
  it("produces output that satisfies the AI-produced analysis schema", async () => {
    const provider = new DemoAIProvider();
    const result = await provider.analyzeLyrics({
      request: baseRequest(),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    const parsed = AIProducedAnalysisSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("clearly labels itself as a demo everywhere a human would read it", async () => {
    const provider = new DemoAIProvider();
    const result = await provider.analyzeLyrics({
      request: baseRequest(),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.disclaimers.join(" ")).toMatch(/MODO DEMONSTRAÇÃO/);
    expect(provider.mode).toBe("demo");
  });
});
