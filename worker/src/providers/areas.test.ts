import type { AnalyzeRequest } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import { extractJson, mergeAreasIntoAnalysis, type AreaShapes, type BiblicalAIShape } from "./areas.js";

function baseRequest(): AnalyzeRequest {
  return {
    lyrics: "Tu és fiel\n\nTu és fiel, tu és fiel",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    revisionMode: "completa",
    bibleTranslationPreference: "dominio_publico_almeida",
  };
}

function biblicalShape(overrides: Partial<BiblicalAIShape> = {}): BiblicalAIShape {
  return {
    mensagemPercebida: "",
    referenciasBiblicas: [],
    observacoesTeologicas: [],
    pontosFortes: [],
    alertas: [],
    ...overrides,
  };
}

describe("extractJson — repairing a response truncated by max_tokens", () => {
  it("keeps the first correção intact and salvages whatever fields the second one finished before the cut", () => {
    const truncated =
      '{"resumo":"Revisão geral.","correcoes":[' +
      '{"trechoOriginal":"Sua mao forte","tipo":"ortografia","gravidade":"alta","explicacao":"Falta acento em mao.","opcao1":"Sua mão forte","opcao2":"Sua forte mão","observacaoDeSentido":"Não muda o sentido."},' +
      '{"trechoOriginal":"me salvo","tipo":"concordancia","gravidade":"alta","explicacao":"texto que fica cortado no meio da explicaç';

    const result = extractJson(truncated) as {
      resumo: string;
      correcoes: Array<{ trechoOriginal: string; explicacao?: string }>;
    };

    expect(result.resumo).toBe("Revisão geral.");
    expect(result.correcoes).toHaveLength(2);
    expect(result.correcoes[0]).toEqual({
      trechoOriginal: "Sua mao forte",
      tipo: "ortografia",
      gravidade: "alta",
      explicacao: "Falta acento em mao.",
      opcao1: "Sua mão forte",
      opcao2: "Sua forte mão",
      observacaoDeSentido: "Não muda o sentido.",
    });
    // The second item's still-open "explicacao" string (and everything after
    // it) never finished before the cutoff, so it's dropped — but the
    // fields that DID finish (trechoOriginal, tipo, gravidade) survive.
    expect(result.correcoes[1]).toEqual({ trechoOriginal: "me salvo", tipo: "concordancia", gravidade: "alta" });
  });

  it("drops a trailing item entirely when it was cut before even its first field finished, instead of leaving a bare object that would fail schema validation", () => {
    const truncated =
      '{"resumo":"","correcoes":[' +
      '{"trechoOriginal":"a","tipo":"ortografia","gravidade":"baixa","explicacao":"","opcao1":"","opcao2":"","observacaoDeSentido":""},' +
      '{"trechoOriginal":"texto cortado no meio da própria string, sem virgula nem fech';

    const result = extractJson(truncated) as { correcoes: Array<{ trechoOriginal: string }> };
    expect(result.correcoes).toHaveLength(1);
    expect(result.correcoes[0].trechoOriginal).toBe("a");
  });

  it("salvages complete entries when truncated right after a dangling comma between array items", () => {
    const truncated =
      '{"resumo":"","correcoes":[' +
      '{"trechoOriginal":"a","tipo":"ortografia","gravidade":"baixa","explicacao":"","opcao1":"","opcao2":"","observacaoDeSentido":""},' +
      '{"trechoOriginal":"b","tipo":"ortografia","gravidade":"baixa","explicacao":"","opcao1":"","opcao2":"","observacaoDeSentido":""},';

    const result = extractJson(truncated) as { correcoes: unknown[] };
    expect(result.correcoes).toHaveLength(2);
  });

  it("still throws when nothing at all is salvageable (truncated before any object even opened)", () => {
    expect(() => extractJson("isto não é json nenhum")).toThrow();
  });

  it("throws (no repair possible) when truncated before any comma or closed container ever appears", () => {
    expect(() => extractJson('{"resumo":"cortado no meio da primeira string sem nenhuma vírg')).toThrow();
  });

  it("parses cleanly-terminated JSON exactly as before, without invoking repair", () => {
    const result = extractJson('{"resumo":"ok","correcoes":[]}') as { resumo: string };
    expect(result.resumo).toBe("ok");
  });
});

describe("mergeAreasIntoAnalysis — biblical reference relation text", () => {
  it("keeps a real, detailed relação com a letra as both excerpt and explanation", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        referenciasBiblicas: [
          {
            referencia: "Salmos 23:4",
            relacaoComALetra: "A letra descreve caminhar em vales escuros sem temer, ecoando este salmo.",
            tipo: "alusao",
          },
        ],
      }),
    };

    const result = mergeAreasIntoAnalysis(baseRequest(), shapes);
    const [ref] = result.bibleReferences;
    expect(ref.excerptFromLyrics).toBe(
      "A letra descreve caminhar em vales escuros sem temer, ecoando este salmo."
    );
    expect(ref.explanation).toBe(
      "A letra descreve caminhar em vales escuros sem temer, ecoando este salmo."
    );
  });

  it("never shows the bare category label ('Temática', 'Alusão'...) as if it were a real excerpt/explanation", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        referenciasBiblicas: [
          { referencia: "Salmos 23:4", relacaoComALetra: "Temática", tipo: "tematica" },
          { referencia: "Isaías 41:10", relacaoComALetra: "Alusão", tipo: "alusao" },
        ],
      }),
    };

    const result = mergeAreasIntoAnalysis(baseRequest(), shapes);
    for (const ref of result.bibleReferences) {
      expect(ref.excerptFromLyrics).not.toBe("Temática");
      expect(ref.excerptFromLyrics).not.toBe("Alusão");
      expect(ref.explanation).not.toBe("Temática");
      expect(ref.explanation).not.toBe("Alusão");
      // Falls back to the reference label itself, never a fabricated excerpt.
      expect(ref.excerptFromLyrics).toBe(ref.referenceLabel);
      expect(ref.explanation.length).toBeGreaterThan(20);
    }
  });

  it("treats an empty relação the same as a vague one", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        referenciasBiblicas: [{ referencia: "Salmos 23:4", relacaoComALetra: "", tipo: "tematica" }],
      }),
    };

    const [ref] = mergeAreasIntoAnalysis(baseRequest(), shapes).bibleReferences;
    expect(ref.excerptFromLyrics).toBe("Salmos 23:4");
  });
});
