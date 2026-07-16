import type { AnalyzeRequest, RevisionMode, SongSection } from "@verbo/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  BiblicalAreaOutput,
  ComposicaoAreaOutput,
  CongregacionalAreaOutput,
  PortuguesAreaOutput,
} from "./areas.js";
import { DemoAIProvider } from "./demoProvider.js";
import type { QuickReview } from "./quickReview.js";
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

// ---- fixtures: one minimal-but-valid payload per area, matching each area's Zod schema ----

function biblicalFixture(): BiblicalAreaOutput {
  return {
    bibleReferences: [
      {
        id: "b1",
        excerptFromLyrics: "Tu és fiel",
        referenceLabel: "Lamentações 3:23",
        book: "Lamentações",
        chapterStart: 3,
        verseStart: 23,
        relationType: "alusao",
        proximity: "alta",
        explanation: "Alusão à fidelidade de Deus.",
        confidence: "medium",
        translationUsed: "dominio_publico_almeida",
        verseTextAvailable: false,
      },
    ],
    biblicalContext: [],
    theologicalClaims: [],
    findings: [],
  };
}

function portuguesFixture(): PortuguesAreaOutput {
  return {
    grammarFindings: [
      {
        id: "g1",
        originalExcerpt: "nós vai",
        type: "concordancia_verbal",
        explanation: "Discordância entre sujeito e verbo.",
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "ia",
      },
    ],
    findings: [],
  };
}

function composicaoFixture(): ComposicaoAreaOutput {
  return {
    overview: {
      perceivedCentralMessage: "Mensagem central de teste",
      compositionType: "Declaração de fé",
      mainEmotion: "Esperança",
      emotionalMovement: "Crescente",
      likelyAudience: "Geral",
      likelyUsageContext: "Culto",
      strengths: ["Ponto forte 1"],
      attentionPoints: [],
      consistencyWithStatedIntent: "consistente",
      consistencyExplanation: "Consistente com a intenção declarada.",
    },
    coherence: {
      messageAppearsClearly: true,
      lyricalSubjectConsistent: true,
      addresseeConsistent: true,
      intensityTrend: "crescente",
      unansweredQuestions: [],
      narrativeMap: { structureType: "declarativa" },
      pointOfView: { dominantPerson: "1ª pessoa", whoSpeaks: "eu lírico", toWhom: "Deus", shifts: [] },
    },
    compositionFindings: [],
    chorusAnalysis: { present: true, candidatePhrases: [] },
    rhymeFindings: [],
    mood: {
      perceivedFunctions: ["devocional"],
      lyricalEmotions: ["esperancosa"],
      textualEnergy: "crescente",
      movementDescription: "Energia crescente.",
      probableStyleHypotheses: [],
      confidence: "medium",
      disclaimer: "Esta classificação considera apenas a letra.",
    },
    findings: [],
  };
}

function congregacionalFixture(): CongregacionalAreaOutput {
  return { congregational: { applicable: true, clarity: "Clara para canto coletivo." }, findings: [] };
}

function quickFixture(): QuickReview {
  return {
    resumo: "Resumo de teste",
    pontosFortes: ["a", "b", "c"],
    correcoesPrioritarias: ["x", "y", "z"],
    sugestaoFinal: "Sugestão final de teste",
  };
}

function fixtureFor(area: (typeof ALL_AREAS)[number]) {
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

const AREA_LABEL_MATCH: Record<(typeof ALL_AREAS)[number], string> = {
  biblica_teologica: "bíblica e teológica",
  portugues: "português",
  composicao: "composição",
  congregacional: "congregacional",
};

/** Both the primary and retry area prompts mention the area's Portuguese label, so tests can route mocked responses without depending on call order. */
function areaFromMessages(messages: Array<{ content: string }>): (typeof ALL_AREAS)[number] {
  const content = messages.map((m) => m.content).join(" ");
  const found = ALL_AREAS.find((area) => content.includes(AREA_LABEL_MATCH[area]));
  if (!found) throw new Error(`could not infer area from mocked call: ${content}`);
  return found;
}

describe("WorkersAIProvider — revisão rápida", () => {
  it("makes exactly one call using the 3B model, max_tokens 500 and temperature 0.1", async () => {
    const run = vi.fn().mockResolvedValue({ response: quickFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("rapida"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const [model, options] = run.mock.calls[0] as [string, { max_tokens: number; temperature: number }];
    expect(model).toBe("@cf/meta/llama-3.2-3b-instruct");
    expect(options.max_tokens).toBe(500);
    expect(options.temperature).toBe(0.1);

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
    const retryOptions = run.mock.calls[1][1] as { max_tokens: number };
    expect(retryOptions.max_tokens).toBe(350);
    expect(result.overview.perceivedCentralMessage).toBe("Resumo de teste");
  });

  it("returns HTTP-mappable AITimeoutError with the exact quick-mode message when both attempts fail", async () => {
    const run = vi.fn().mockRejectedValue(new Error("3046: Request timeout"));
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    await expect(
      provider.analyzeLyrics({
        request: baseRequest("rapida"),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      })
    ).rejects.toThrow(AITimeoutError);
    expect(run).toHaveBeenCalledTimes(2);

    const run2 = vi.fn().mockRejectedValue(new Error("3046: Request timeout"));
    const provider2 = new WorkersAIProvider({ run: run2 } as unknown as Ai);
    try {
      await provider2.analyzeLyrics({
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
  });

  it("also retries and 504s on a malformed (non-timeout) response, per 'se as duas tentativas falharem'", async () => {
    const run = vi.fn().mockResolvedValue({ response: { not: "valid" } });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    await expect(
      provider.analyzeLyrics({
        request: baseRequest("rapida"),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      })
    ).rejects.toThrow(AITimeoutError);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("WorkersAIProvider — revisão completa (4 area calls)", () => {
  it("makes exactly four calls — one per area — never a fifth", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: { messages: Array<{ content: string }> }) => {
      const area = areaFromMessages(options.messages);
      return { response: fixtureFor(area) };
    });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("completa"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(4);
    for (const options of run.mock.calls.map((c) => c[1] as { max_tokens: number; temperature: number })) {
      expect(options.max_tokens).toBe(500);
      expect(options.temperature).toBe(0.15);
    }
    expect(result.sectionStatus).toEqual({});
    // Data from every area made it into the merged result.
    expect(result.bibleReferences).toHaveLength(1);
    expect(result.grammarFindings).toHaveLength(1);
    expect(result.overview.perceivedCentralMessage).toBe("Mensagem central de teste");
    expect(result.congregational.applicable).toBe(true);
  });

  it("retries only the area that timed out, leaving the other three at one call each", async () => {
    const callsPerArea = new Map<string, number>();
    const run = vi.fn().mockImplementation(async (_model: string, options: { messages: Array<{ content: string }> }) => {
      const area = areaFromMessages(options.messages);
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

    // 4 areas, one of which (português) needed a retry = 5 calls total.
    expect(run).toHaveBeenCalledTimes(5);
    expect(callsPerArea.get("portugues")).toBe(2);
    expect(callsPerArea.get("biblica_teologica")).toBe(1);
    expect(callsPerArea.get("composicao")).toBe(1);
    expect(callsPerArea.get("congregacional")).toBe(1);
    expect(result.sectionStatus).toEqual({});
    expect(result.grammarFindings).toHaveLength(1);
  });

  it("returns a partial report when one area fails both attempts — other areas' real data is preserved", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: { messages: Array<{ content: string }> }) => {
      const area = areaFromMessages(options.messages);
      if (area === "portugues") {
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

    // português failed twice (initial + retry); the other three areas succeeded once each = 5 calls.
    expect(run).toHaveBeenCalledTimes(5);
    expect(result.sectionStatus).toEqual({
      portugues: {
        status: "indisponivel",
        mensagem: "Esta parte da análise demorou mais que o esperado. Tente novamente.",
      },
    });
    // The areas that succeeded were not discarded.
    expect(result.bibleReferences).toHaveLength(1);
    expect(result.overview.perceivedCentralMessage).toBe("Mensagem central de teste");
    expect(result.congregational.applicable).toBe(true);
    // The failed area falls back to empty/neutral content rather than being omitted.
    expect(result.grammarFindings).toEqual([]);
  });

  it("does not retry a non-timeout failure — the area is marked unavailable immediately", async () => {
    const run = vi.fn().mockImplementation(async (_model: string, options: { messages: Array<{ content: string }> }) => {
      const area = areaFromMessages(options.messages);
      if (area === "biblica_teologica") {
        throw new Error("500: Internal error");
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

    // No retry for the failed (non-timeout) area: 4 calls total, not 5.
    expect(run).toHaveBeenCalledTimes(4);
    expect(result.sectionStatus).toEqual({
      biblica_teologica: {
        status: "indisponivel",
        mensagem: "Esta parte da análise demorou mais que o esperado. Tente novamente.",
      },
    });
  });
});

describe("WorkersAIProvider — individual review modes (one area)", () => {
  it("makes exactly one call for the selected area, with max_tokens between 500 and 700", async () => {
    const run = vi.fn().mockResolvedValue({ response: portuguesFixture() });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest("portugues"),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    const options = run.mock.calls[0][1] as { max_tokens: number };
    expect(options.max_tokens).toBeGreaterThanOrEqual(500);
    expect(options.max_tokens).toBeLessThanOrEqual(700);
    expect(result.grammarFindings).toHaveLength(1);
    // Areas not requested in this mode are not attempted, so they carry no status entry.
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
