import type { AnalyzeRequest, RevisionMode, SongSection } from "@verbo/shared";
import { describe, expect, it, vi } from "vitest";
import {
  ALL_AREAS as AREAS,
  areaJsonSchema,
  type BiblicalAIShape,
  type ComposicaoAIShape,
  type CongregacionalAIShape,
  type PortuguesAIShape,
} from "./areas.js";
import { DemoAIProvider } from "./demoProvider.js";
import { QUICK_JSON_SCHEMA, type QuickReview } from "./quickReview.js";
import { AITimeoutError, ALL_AREAS, WorkersAIProvider } from "./workersAIProvider.js";

function baseRequest(mode: RevisionMode = "completa"): AnalyzeRequest {
  return {
    lyrics: "Tu és fiel\n\nTu és fiel, tu és fiel",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    revisionMode: mode,
    bibleTranslationPreference: "dominio_publico_almeida",
  };
}

function sections(): SongSection[] {
  return [
    { id: "sec-1", type: "verso", index: 1, label: "Verso 1", text: "Tu és fiel", startLine: 0, endLine: 0 },
  ];
}

// ---- fixtures: one realistic payload per area, matching each area's minimal Zod schema ----

function biblicalFixture(): BiblicalAIShape {
  return {
    mensagemPercebida: "Confiança em Deus mesmo em tempos difíceis.",
    referenciasBiblicas: [
      { referencia: "Lamentações 3:23", relacaoComALetra: "Alusão à fidelidade de Deus.", tipo: "alusao" },
    ],
    observacoesTeologicas: ["A letra reforça a fidelidade divina."],
    pontosFortes: ["Mensagem teológica clara."],
    alertas: [],
  };
}

function portuguesFixture(): PortuguesAIShape {
  return {
    correcoes: [{ trecho: "nós vai", problema: "Discordância verbal.", sugestao: "nós vamos" }],
    pontosFortes: ["Vocabulário simples e direto."],
  };
}

function composicaoFixture(): ComposicaoAIShape {
  return {
    estrutura: "poetica",
    classificacaoLirica: "reflexiva",
    emocao: "contemplativa",
    energiaTextual: "constante",
    temaCentral: "A fidelidade de Deus em meio às dificuldades",
    observacoesProducao: ["Funciona bem em arranjo acústico."],
    pontosFortes: ["Refrão memorável."],
    sugestoes: ["Considere expandir a ponte."],
  };
}

function congregacionalFixture(): CongregacionalAIShape {
  return {
    adequacao: "Adequada para culto congregacional.",
    facilidadeDeCanto: "Fácil de cantar em grupo.",
    clarezaDaMensagem: "Mensagem clara para a congregação.",
    pontosFortes: ["Repetição ajuda memorização."],
    sugestoes: [],
  };
}

function quickFixture(): QuickReview {
  return {
    resumo: "Resumo de teste",
    pontosFortes: ["a", "b", "c"],
    correcoesPrioritarias: ["x", "y", "z"],
    sugestaoFinal: "Sugestão final de teste",
  };
}

function fixtureFor(area: (typeof AREAS)[number]) {
  switch (area) {
    case "biblica_teologica":
      return biblicalFixture();
    case "portugues":
      return portuguesFixture();
    case "composicao":
      return composicaoFixture();
    case "congregacional":
      return congregacionalFixture();
  }
}

interface RunOptions {
  messages: Array<{ role: string; content: string }>;
  response_format: { type: string; json_schema: unknown };
  max_tokens: number;
  temperature: number;
}

/** Every area has its own distinct JSON Schema object, so tests can route mocked responses by identity instead of guessing from prompt text. */
function areaFromCall(options: RunOptions): (typeof AREAS)[number] {
  const found = AREAS.find((area) => options.response_format.json_schema === areaJsonSchema(area));
  if (!found) throw new Error("could not infer area from mocked call's response_format.json_schema");
  return found;
}

describe("WorkersAIProvider — revisão rápida", () => {
  it("makes exactly one call using the 3B model, JSON Schema mode, max_tokens 500 and temperature 0.1", async () => {
    const run = vi.fn().mockResolvedValue({ response: quickFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("rapida"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const [model, options] = run.mock.calls[0] as [string, RunOptions];
    expect(model).toBe("@cf/meta/llama-3.2-3b-instruct");
    expect(options.max_tokens).toBe(500);
    expect(options.temperature).toBe(0.1);
    expect(options.response_format).toEqual({ type: "json_schema", json_schema: QUICK_JSON_SCHEMA });

    expect(result.overview.perceivedCentralMessage).toBe("Resumo de teste");
    expect(result.overview.strengths).toEqual(["a", "b", "c"]);
    expect(result.overview.attentionPoints).toEqual(["x", "y", "z"]);
    expect(result.findings.some((f) => f.explanation === "Sugestão final de teste")).toBe(true);
  });

  it("retries once with a smaller prompt after a timeout, and succeeds", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("3046: Request timeout"))
      .mockResolvedValueOnce({ response: quickFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("rapida"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(2);
    const retryOptions = run.mock.calls[1][1] as RunOptions;
    expect(retryOptions.max_tokens).toBe(350);
    expect(result.overview.perceivedCentralMessage).toBe("Resumo de teste");
  });

  it("returns AITimeoutError with the exact quick-mode message when both attempts fail", async () => {
    const run = vi.fn().mockRejectedValue(new Error("3046: Request timeout"));
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    try {
      await provider.analyzeLyrics({
        request: baseRequest("rapida"),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AITimeoutError);
      expect((err as Error).message).toBe(
        "A análise demorou mais que o esperado. Tente novamente em alguns instantes."
      );
    }
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("WorkersAIProvider — revisão completa (4 area calls)", () => {
  it("makes exactly four calls — one per area — each using JSON Schema mode", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      return { response: fixtureFor(areaFromCall(options)) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(4);
    for (const options of run.mock.calls.map((c) => c[1] as RunOptions)) {
      expect(options.max_tokens).toBe(500);
      expect(options.temperature).toBe(0.15);
      expect(options.response_format.type).toBe("json_schema");
    }
    expect(result.sectionStatus).toEqual({});
    expect(result.bibleReferences).toHaveLength(1);
    expect(result.grammarFindings).toHaveLength(1);
  });

  it("resposta com JSON Mode deve preencher todos os campos esperados do merge", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      return { response: fixtureFor(areaFromCall(options)) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    // structure: composicao.estrutura "poetica" → "poética", used directly (no "Não determinado" prefix)
    expect(result.overview.compositionType).toBe("poética");
    expect(result.overview.compositionType).not.toMatch(/não determinado/i);

    // emotion: composicao.emocao "contemplativa" preserved as-is
    expect(result.overview.mainEmotion).toBe("contemplativa");
    expect(result.mood.lyricalEmotions).toContain("contemplativa");

    // textual energy: composicao.energiaTextual "constante" preserved
    expect(result.mood.textualEnergy).toBe("constante");

    // messagePerceived: biblical.mensagemPercebida takes priority when present
    expect(result.overview.perceivedCentralMessage).toBe("Confiança em Deus mesmo em tempos difíceis.");

    // productionNotes: composicao.observacoesProducao flows into movementDescription
    expect(result.mood.movementDescription).toContain("arranjo acústico");

    // congregationalFit-related fields
    expect(result.congregational.clarity).toBe("Mensagem clara para a congregação.");
    expect(result.congregational.singability).toBe("Fácil de cantar em grupo.");

    // bibleReferences: mapped from biblical.referenciasBiblicas
    expect(result.bibleReferences[0].referenceLabel).toBe("Lamentações 3:23");
    expect(result.bibleReferences[0].book).toBe("Lamentações");
    expect(result.bibleReferences[0].chapterStart).toBe(3);
    expect(result.bibleReferences[0].verseStart).toBe(23);

    // strengths: union across all four areas, deduplicated
    expect(result.overview.strengths).toEqual(
      expect.arrayContaining([
        "Mensagem teológica clara.",
        "Vocabulário simples e direto.",
        "Refrão memorável.",
        "Repetição ajuda memorização.",
      ])
    );
  });

  it("mensagem usa composition.temaCentral quando a seção bíblica falha", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "biblica_teologica") {
        throw new Error("500: erro genérico");
      }
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.overview.perceivedCentralMessage).toBe("A fidelidade de Deus em meio às dificuldades");
    expect(result.sectionStatus.biblica_teologica.status).toBe("indisponivel");
  });

  it("recupera um JSON envolvido em um bloco de código markdown", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      const fixture = fixtureFor(area);
      return { response: "```json\n" + JSON.stringify(fixture) + "\n```" };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.sectionStatus).toEqual({});
    expect(result.overview.compositionType).toBe("poética");
  });

  it("retries only the area that timed out, leaving the other three at one call each", async () => {
    const callsPerArea = new Map<string, number>();
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      const seen = (callsPerArea.get(area) ?? 0) + 1;
      callsPerArea.set(area, seen);
      if (area === "portugues" && seen === 1) {
        throw new Error("3046: Request timeout");
      }
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(5);
    expect(callsPerArea.get("portugues")).toBe(2);
    expect(callsPerArea.get("biblica_teologica")).toBe(1);
    expect(callsPerArea.get("composicao")).toBe(1);
    expect(callsPerArea.get("congregacional")).toBe(1);
    expect(result.sectionStatus).toEqual({});
  });

  it("marca timeout (não formato_invalido) quando ambas as tentativas de uma área excedem o tempo", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "portugues") throw new Error("3046: Request timeout");
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.sectionStatus).toEqual({
      portugues: {
        status: "timeout",
        mensagem: "Esta parte da análise demorou mais que o esperado. Tente novamente.",
      },
    });
    // The areas that succeeded were not discarded.
    expect(result.bibleReferences).toHaveLength(1);
    expect(result.overview.compositionType).toBe("poética");
  });

  it("marca formato_invalido (não timeout) quando a resposta não é um JSON válido nas duas tentativas", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "composicao") return { response: "isto não é um JSON de forma alguma" };
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.sectionStatus).toEqual({
      composicao: {
        status: "formato_invalido",
        mensagem: "A resposta desta seção não pôde ser processada.",
      },
    });
  });

  it("preserva campos válidos de uma área mesmo quando outro campo dela é inválido", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "composicao") {
        // estrutura/classificacaoLirica/emocao are valid; energiaTextual has the wrong type.
        return {
          response: {
            estrutura: "poetica",
            classificacaoLirica: "reflexiva",
            emocao: "contemplativa",
            energiaTextual: 12345,
            temaCentral: "Tema válido",
            observacoesProducao: [],
            pontosFortes: [],
            sugestoes: [],
          },
        };
      }
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    // Not marked unavailable — most fields were valid.
    expect(result.sectionStatus.composicao).toBeUndefined();
    expect(result.overview.compositionType).toBe("poética");
    expect(result.overview.mainEmotion).toBe("contemplativa");
    // Only the single bad field falls back to a safe default.
    expect(result.mood.textualEnergy).toBe("constante");
  });

  it("retries exactly once on a generic (non-timeout, non-format) error too, then marks it indisponível", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "biblica_teologica") throw new Error("500: Internal error");
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    // One retry for the failing area (not a chain of retries): 4 areas + 1 retry = 5 calls, never a 5th area.
    expect(run).toHaveBeenCalledTimes(5);
    expect(result.sectionStatus).toEqual({
      biblica_teologica: {
        status: "indisponivel",
        mensagem: "Não foi possível concluir esta parte da análise agora. Tente novamente.",
      },
    });
  });
});

describe("WorkersAIProvider — individual review modes (one area)", () => {
  it("makes exactly one call for the selected area, with max_tokens between 500 and 700", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      return { response: fixtureFor(areaFromCall(options)) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const options = run.mock.calls[0][1] as RunOptions;
    expect(options.max_tokens).toBeGreaterThanOrEqual(500);
    expect(options.max_tokens).toBeLessThanOrEqual(700);
    expect(result.grammarFindings).toHaveLength(1);
    expect(result.sectionStatus).toEqual({});
  });
});

describe("DemoAIProvider unaffected by the area split", () => {
  it("still returns a schema-valid full analysis regardless of revisionMode", async () => {
    const provider = new DemoAIProvider();
    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });
    expect(result.sectionStatus).toEqual({});
    expect(provider.mode).toBe("demo");
  });
});

describe("ALL_AREAS re-export", () => {
  it("matches areas.ts's ALL_AREAS", () => {
    expect(ALL_AREAS).toEqual(AREAS);
  });
});
