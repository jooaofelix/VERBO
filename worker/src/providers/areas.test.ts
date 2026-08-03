import type { AnalyzeRequest, SongSection } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import {
  areaRetryUserPayload,
  areaUserPayload,
  extractJson,
  mergeAreasIntoAnalysis,
  type AreaShapes,
  type BiblicalAIShape,
  type PortuguesAIShape,
} from "./areas.js";

function baseRequest(bibleReferencesProvidedByUser: string[] = []): AnalyzeRequest {
  return {
    lyrics: "Tu és fiel\n\nTu és fiel, tu és fiel",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser,
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
    consistenciaComReferenciaDoUsuario: "nao_foi_possivel_determinar",
    explicacaoConsistenciaReferencia: "",
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

  it("also falls back to the reference label for a short fragment that isn't a real category echo but still isn't a real sentence", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        referenciasBiblicas: [{ referencia: "Salmos 23:4", relacaoComALetra: "Fala de Deus.", tipo: "tematica" }],
      }),
    };

    const [ref] = mergeAreasIntoAnalysis(baseRequest(), shapes).bibleReferences;
    expect(ref.excerptFromLyrics).toBe("Salmos 23:4");
  });

  it("keeps a genuinely detailed relação even when it doesn't literally match a known category-echo string", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        referenciasBiblicas: [
          {
            referencia: "Salmos 23:4",
            relacaoComALetra:
              "A imagem de 'caminhar por vales escuros sem temer' remete diretamente à confiança descrita neste salmo.",
            tipo: "alusao",
          },
        ],
      }),
    };

    const [ref] = mergeAreasIntoAnalysis(baseRequest(), shapes).bibleReferences;
    expect(ref.explanation).toContain("caminhar por vales escuros");
  });
});

function portuguesShape(overrides: Partial<PortuguesAIShape> = {}): PortuguesAIShape {
  return {
    resumo: "",
    correcoes: [],
    problemasDeConsistencia: [],
    pontosFortes: [],
    prioridades: [],
    ...overrides,
  };
}

describe("mergeAreasIntoAnalysis — grammar explanation depth", () => {
  it("drops a correção whose explicação is just a short generic fragment, not a real sentence", () => {
    const shapes: AreaShapes = {
      portugues: portuguesShape({
        correcoes: [
          {
            trechoOriginal: "nós vai",
            tipo: "concordancia",
            gravidade: "alta",
            explicacao: "Erro de concordância.",
            opcao1: "nós vamos",
            opcao2: "",
            observacaoDeSentido: "",
          },
        ],
      }),
    };

    const result = mergeAreasIntoAnalysis(baseRequest(), shapes);
    expect(result.grammarFindings.some((f) => f.originalExcerpt === "nós vai")).toBe(false);
  });

  it("keeps a correção with a real, specific two-sentence explanation", () => {
    const shapes: AreaShapes = {
      portugues: portuguesShape({
        correcoes: [
          {
            trechoOriginal: "nós vai",
            tipo: "concordancia",
            gravidade: "alta",
            explicacao:
              "O verbo \"vai\" está conjugado na terceira pessoa do singular, mas o sujeito \"nós\" exige a " +
              "primeira pessoa do plural.",
            opcao1: "nós vamos",
            opcao2: "",
            observacaoDeSentido: "",
          },
        ],
      }),
    };

    const result = mergeAreasIntoAnalysis(baseRequest(), shapes);
    expect(result.grammarFindings.some((f) => f.originalExcerpt === "nós vai")).toBe(true);
  });
});

describe("areaUserPayload — Gemini gets a richer, higher-capacity prompt", () => {
  const sections: SongSection[] = [
    { id: "sec-1", type: "verso", index: 1, label: "Verso 1", text: "Tu és fiel", startLine: 0, endLine: 0 },
  ];

  it("uses the terse default focus for português by default", () => {
    const payload = areaUserPayload("portugues", baseRequest(), sections);
    expect(payload).toContain("no máximo 6 problemas");
  });

  it("uses a richer, higher-cap focus for português when the 'gemini' variant is requested", () => {
    const payload = areaUserPayload("portugues", baseRequest(), sections, "gemini");
    expect(payload).toContain("até 10 problemas reais");
    expect(payload).toContain("pelo menos duas frases específicas");
  });

  it("asks Gemini for 2-3 biblical references with a two-part explanation, unlike the default focus", () => {
    const defaultPayload = areaUserPayload("biblica_teologica", baseRequest(), sections);
    const geminiPayload = areaUserPayload("biblica_teologica", baseRequest(), sections, "gemini");

    expect(defaultPayload).not.toContain("2 ou 3 referências");
    expect(geminiPayload).toContain("2 ou 3 referências");
    expect(geminiPayload).toContain("pelo menos duas frases específicas");
  });

  it("gives composicao and congregacional richer, more specific prompts too, since Gemini now covers every area", () => {
    const defaultComposicao = areaUserPayload("composicao", baseRequest(), sections);
    const geminiComposicao = areaUserPayload("composicao", baseRequest(), sections, "gemini");
    expect(geminiComposicao).not.toBe(defaultComposicao);
    expect(geminiComposicao).toContain("duas ou três observações específicas");

    const defaultCongregacional = areaUserPayload("congregacional", baseRequest(), sections);
    const geminiCongregacional = areaUserPayload("congregacional", baseRequest(), sections, "gemini");
    expect(geminiCongregacional).not.toBe(defaultCongregacional);
    expect(geminiCongregacional).toContain("pelo menos duas frases específicas");
  });
});

describe("areaUserPayload / areaRetryUserPayload — user-provided base verse(s)", () => {
  const sections: SongSection[] = [
    { id: "sec-1", type: "verso", index: 1, label: "Verso 1", text: "Tu és fiel", startLine: 0, endLine: 0 },
  ];

  it("adds no consistency instructions when the composer provided no base reference", () => {
    const payload = areaUserPayload("biblica_teologica", baseRequest([]), sections);
    expect(payload).not.toContain("consistenciaComReferenciaDoUsuario");
  });

  it("does not add consistency instructions to unrelated areas even when references are provided", () => {
    const payload = areaUserPayload("composicao", baseRequest(["João 3:16"]), sections);
    expect(payload).not.toContain("consistenciaComReferenciaDoUsuario");
  });

  it("asks the AI to evaluate consistency against a single user-provided base verse", () => {
    const payload = areaUserPayload("biblica_teologica", baseRequest(["João 3:16"]), sections);
    expect(payload).toContain("João 3:16");
    expect(payload).toContain("consistenciaComReferenciaDoUsuario");
    expect(payload).toContain("contexto geral");
  });

  it("mentions all base verses and uses plural phrasing when more than one is provided", () => {
    const payload = areaUserPayload("biblica_teologica", baseRequest(["João 3:16", "Salmos 23:1"]), sections);
    expect(payload).toContain("João 3:16");
    expect(payload).toContain("Salmos 23:1");
    expect(payload).toContain("referências bíblicas base");
  });

  it("includes a concise version of the same instruction in the retry payload", () => {
    const payload = areaRetryUserPayload("biblica_teologica", sections, ["João 3:16"]);
    expect(payload).toContain("João 3:16");
    expect(payload).toContain("consistenciaComReferenciaDoUsuario");
  });

  it("retry payload has no consistency instructions when no references were provided", () => {
    const payload = areaRetryUserPayload("biblica_teologica", sections);
    expect(payload).not.toContain("consistenciaComReferenciaDoUsuario");
  });
});

describe("mergeAreasIntoAnalysis — consistency with user-provided base verse(s)", () => {
  it("keeps the placeholder verdict when the composer provided no base reference", () => {
    const shapes: AreaShapes = { biblica_teologica: biblicalShape() };
    const { overview } = mergeAreasIntoAnalysis(baseRequest([]), shapes);
    expect(overview.consistencyWithStatedIntent).toBe("nao_foi_possivel_determinar");
    expect(overview.consistencyExplanation).toContain("nenhuma referência bíblica base foi informada");
  });

  it("uses the AI's real verdict and explanation when a base reference was provided and answered in detail", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        consistenciaComReferenciaDoUsuario: "consistente",
        explicacaoConsistenciaReferencia:
          "A letra fala de confiança em meio à dificuldade, o que está alinhado ao contexto de conforto " +
          "presente em João 3:16 sobre o amor de Deus pelo mundo.",
      }),
    };
    const { overview } = mergeAreasIntoAnalysis(baseRequest(["João 3:16"]), shapes);
    expect(overview.consistencyWithStatedIntent).toBe("consistente");
    expect(overview.consistencyExplanation).toContain("confiança em meio à dificuldade");
  });

  it("falls back to a not-reliable message when a base reference was provided but the AI's explanation is too vague", () => {
    const shapes: AreaShapes = {
      biblica_teologica: biblicalShape({
        consistenciaComReferenciaDoUsuario: "consistente",
        explicacaoConsistenciaReferencia: "Faz sentido.",
      }),
    };
    const { overview } = mergeAreasIntoAnalysis(baseRequest(["João 3:16"]), shapes);
    expect(overview.consistencyExplanation).toContain("Não foi possível avaliar de forma confiável");
  });
});
