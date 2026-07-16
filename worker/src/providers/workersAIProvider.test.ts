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
    resumo: "A letra tem boas imagens, mas precisa de ajustes de concordância e consistência de pessoa.",
    correcoes: [
      {
        trechoOriginal: "nós vai",
        tipo: "concordancia",
        gravidade: "alta",
        explicacao: "O verbo \"vai\" está na terceira pessoa do singular, mas o sujeito \"nós\" exige a primeira pessoa do plural.",
        opcao1: "nós vamos",
        opcao2: "",
        observacaoDeSentido: "",
      },
    ],
    problemasDeConsistencia: [],
    pontosFortes: ["Vocabulário simples e direto."],
    prioridades: ["Corrigir \"nós vai\" para \"nós vamos\"."],
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
    for (const call of run.mock.calls) {
      const [model, options] = call as [string, RunOptions];
      expect(options.response_format.type).toBe("json_schema");
      if (model === "@cf/meta/llama-3.1-8b-instruct-fast") {
        // "português" is the one area allowed to use the bigger model.
        expect(options.max_tokens).toBeGreaterThanOrEqual(650);
        expect(options.max_tokens).toBeLessThanOrEqual(850);
        expect(options.temperature).toBe(0.1);
      } else {
        expect(model).toBe("@cf/meta/llama-3.2-3b-instruct");
        expect(options.max_tokens).toBe(500);
        expect(options.temperature).toBe(0.15);
      }
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
      request: baseRequest("biblica_teologica"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const options = run.mock.calls[0][1] as RunOptions;
    expect(options.max_tokens).toBeGreaterThanOrEqual(500);
    expect(options.max_tokens).toBeLessThanOrEqual(700);
    expect(result.bibleReferences).toHaveLength(1);
    expect(result.sectionStatus).toEqual({});
  });
});

describe("WorkersAIProvider — português: bigger model, isolated call, detailed corrections", () => {
  it("uses llama-3.1-8b-instruct-fast with 650-850 tokens and temperature 0.1 for a single português call", async () => {
    const run = vi.fn().mockResolvedValue({ response: portuguesFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const [model, options] = run.mock.calls[0] as [string, RunOptions];
    expect(model).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(options.max_tokens).toBeGreaterThanOrEqual(650);
    expect(options.max_tokens).toBeLessThanOrEqual(850);
    expect(options.temperature).toBe(0.1);
    expect(result.grammarFindings).toHaveLength(1);
  });

  it("retries a timed-out português call with the 3B model and 450 tokens, not the 8B model again", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("3046: Request timeout"))
      .mockResolvedValueOnce({ response: portuguesFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(2);
    const [firstModel] = run.mock.calls[0] as [string, RunOptions];
    const [retryModel, retryOptions] = run.mock.calls[1] as [string, RunOptions];
    expect(firstModel).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(retryModel).toBe("@cf/meta/llama-3.2-3b-instruct");
    expect(retryOptions.max_tokens).toBe(450);
  });

  it("produces specific, actionable corrections for the example lyric — never vague generic text", async () => {
    const run = vi.fn().mockResolvedValue({
      response: {
        resumo: "Revisão detalhada da letra de testemunho.",
        correcoes: [
          {
            trechoOriginal: "Sua mao forte me salvou",
            tipo: "ortografia",
            gravidade: "media",
            explicacao: "\"mao\" precisa do acento circunflexo: a grafia correta é \"mão\".",
            opcao1: "Sua mão forte me salvou.",
            opcao2: "",
            observacaoDeSentido: "",
          },
          {
            trechoOriginal: "sua forte mão me salvo",
            tipo: "concordancia",
            gravidade: "alta",
            explicacao:
              "\"salvo\" está no presente do indicativo na primeira pessoa, ou funciona como adjetivo; para indicar uma ação " +
              "passada realizada por Deus, o verbo correto é \"salvou\".",
            opcao1: "Sua forte mão me salvou.",
            opcao2: "",
            observacaoDeSentido: "",
          },
          {
            trechoOriginal: "Esperança e graça em ti encontrou",
            tipo: "concordancia",
            gravidade: "media",
            explicacao:
              "Não fica claro quem encontrou esperança e graça — o verbo \"encontrou\" está na terceira pessoa, mas o " +
              "sujeito não aparece claramente na frase.",
            opcao1: "Em ti, esperança e graça encontrei.",
            opcao2: "Meu coração encontrou em ti esperança e graça.",
            observacaoDeSentido: "As duas opções mantêm o sentido original, apenas deixando o sujeito explícito.",
          },
          {
            trechoOriginal: "Grande amor / Nos mostrou",
            tipo: "coerencia",
            gravidade: "media",
            explicacao: "Não fica claro quem mostrou o grande amor nem o que foi mostrado.",
            opcao1: "Seu grande amor nos alcançou.",
            opcao2: "Seu grande amor nos mostrou o caminho.",
            observacaoDeSentido: "A opção 2 acrescenta a ideia de direção/caminho, ausente no trecho original.",
          },
        ],
        problemasDeConsistencia: [
          "A letra alterna entre primeira pessoa do singular (\"me salvou\") e primeira pessoa do plural " +
            "(\"nos mostrou\", \"vamos desfrutar\") sem uma transição clara — vale perguntar ao compositor se " +
            "deseja um testemunho pessoal ou uma canção coletiva.",
        ],
        pontosFortes: ["Progressão do medo para a esperança ao longo da letra."],
        prioridades: [
          "Definir se a letra será narrada em \"eu\" ou \"nós\".",
          "Corrigir \"me salvo\" para \"me salvou\".",
          "Reescrever \"Esperança e graça em ti encontrou\".",
          "Completar a construção \"Grande amor / Nos mostrou\".",
          "Uniformizar o refrão e o tamanho das linhas.",
        ],
      },
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    // "mao" → "mão"
    const orthography = result.grammarFindings.find((f) => f.originalExcerpt === "Sua mao forte me salvou");
    expect(orthography?.type).toBe("ortografia");
    expect(orthography?.possibleCorrection).toBe("Sua mão forte me salvou.");
    expect(orthography?.explanation).toContain("acento circunflexo");

    // "me salvo" → "me salvou"
    const conjugation = result.grammarFindings.find((f) => f.originalExcerpt === "sua forte mão me salvo");
    expect(conjugation?.possibleCorrection).toBe("Sua forte mão me salvou.");
    expect(conjugation?.explanation).toContain("salvou");

    // "Esperança e graça em ti encontrou" — unclear subject/agreement, two rewrite options
    const agreement = result.grammarFindings.find(
      (f) => f.originalExcerpt === "Esperança e graça em ti encontrou"
    );
    expect(agreement?.possibleCorrection).toBe("Em ti, esperança e graça encontrei.");
    expect(agreement?.alternativeCorrection).toBe("Meu coração encontrou em ti esperança e graça.");
    expect(agreement?.meaningChangeNote).toBeTruthy();

    // Every correction must cite a real excerpt and a substantive (non-vague) explanation.
    for (const finding of result.grammarFindings) {
      expect(finding.originalExcerpt.length).toBeGreaterThan(0);
      expect(finding.explanation.length).toBeGreaterThan(15);
      expect(finding.explanation.toLowerCase()).not.toMatch(/pode melhorar|precisa ser revist|pode ficar mais clar/);
    }

    // "eu" vs "nós" inconsistency surfaced explicitly.
    expect(
      result.narrativeConsistencyIssues.some((issue) => issue.includes("primeira pessoa"))
    ).toBe(true);

    // Priorities: at most 5, in order, concrete and actionable.
    expect(result.topPriorities.length).toBeLessThanOrEqual(5);
    expect(result.topPriorities[0]).toMatch(/eu.*nós|nós.*eu/i);

    // Strengths cite something concrete from the lyric, not a generic compliment.
    expect(result.overview.strengths).toContain("Progressão do medo para a esperança ao longo da letra.");
  });

  it("drops corrections with vague, non-actionable explanations instead of surfacing them", async () => {
    const run = vi.fn().mockResolvedValue({
      response: {
        resumo: "",
        correcoes: [
          {
            trechoOriginal: "algum trecho",
            tipo: "fluidez",
            gravidade: "baixa",
            explicacao: "Pode melhorar a fluidez.",
            opcao1: "",
            opcao2: "",
            observacaoDeSentido: "",
          },
          {
            trechoOriginal: "outro trecho",
            tipo: "concordancia",
            gravidade: "media",
            explicacao: "A concordância precisa ser revista.",
            opcao1: "",
            opcao2: "",
            observacaoDeSentido: "",
          },
          {
            trechoOriginal: "Sua mao forte me salvou",
            tipo: "ortografia",
            gravidade: "media",
            explicacao: "\"mao\" precisa do acento circunflexo: a grafia correta é \"mão\".",
            opcao1: "Sua mão forte me salvou.",
            opcao2: "",
            observacaoDeSentido: "",
          },
        ],
        problemasDeConsistencia: [],
        pontosFortes: [],
        prioridades: [],
      },
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.grammarFindings).toHaveLength(1);
    expect(result.grammarFindings[0].originalExcerpt).toBe("Sua mao forte me salvou");
  });

  it("never classifies the lyric as 'autoajuda' — corrects the label if a model ever produces it", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: RunOptions) => {
      const area = areaFromCall(options);
      if (area === "composicao") {
        return {
          response: {
            ...composicaoFixture(),
            temaCentral: "Uma canção de autoajuda sobre superação pessoal",
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

    expect(result.overview.perceivedCentralMessage.toLowerCase()).not.toContain("autoajuda");
  });

  it("caps topPriorities at 5 even if the model returns more", async () => {
    const run = vi.fn().mockResolvedValue({
      response: {
        ...portuguesFixture(),
        prioridades: ["um", "dois", "três", "quatro", "cinco", "seis", "sete"],
      },
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.topPriorities).toHaveLength(5);
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
