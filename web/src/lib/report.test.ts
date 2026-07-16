import type { AnalysisResult } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import type { SongDoc, VersionDoc, WithId } from "../types/firestore.js";
import { buildFinalReport } from "./report.js";

function song(): WithId<SongDoc> {
  return {
    id: "song-1",
    title: "Minha Composição",
    language: "pt-BR",
    congregational: false,
    hasAudio: false,
    userId: "u1",
    status: "active",
    version: 1,
    createdAt: {} as SongDoc["createdAt"],
    updatedAt: {} as SongDoc["updatedAt"],
  };
}

function version(): WithId<VersionDoc> {
  return {
    id: "v1",
    versionName: "Versão 1",
    lyrics: "Sua mao forte me salvou",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    userId: "u1",
    status: "active",
    version: 1,
    createdAt: {} as VersionDoc["createdAt"],
    updatedAt: {} as VersionDoc["updatedAt"],
  };
}

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    id: "a1",
    createdAt: new Date().toISOString(),
    revisionMode: "portugues",
    overview: {
      perceivedCentralMessage: "Testemunho de fidelidade de Deus.",
      compositionType: "poética",
      mainEmotion: "contemplativa",
      emotionalMovement: "poética",
      likelyAudience: "Geral",
      likelyUsageContext: "culto",
      strengths: ["Progressão do medo para a esperança."],
      attentionPoints: [],
      consistencyWithStatedIntent: "nao_foi_possivel_determinar",
      consistencyExplanation: "N/A",
    },
    bibleReferences: [],
    biblicalContext: [],
    theologicalClaims: [],
    coherence: {
      messageAppearsClearly: true,
      lyricalSubjectConsistent: true,
      addresseeConsistent: true,
      intensityTrend: "estatica",
      unansweredQuestions: [],
      narrativeMap: { structureType: "poetica" },
      pointOfView: { dominantPerson: "1ª pessoa", whoSpeaks: "eu lírico", toWhom: "Deus", shifts: [] },
    },
    grammarFindings: [
      {
        id: "gram-1",
        originalExcerpt: "Sua mao forte me salvou",
        type: "ortografia",
        explanation: '"mao" precisa do acento circunflexo: a grafia correta é "mão".',
        possibleCorrection: "Sua mão forte me salvou.",
        severity: "media",
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "ia",
      },
      {
        id: "gram-2",
        originalExcerpt: "Esperança e graça em ti encontrou",
        type: "concordancia_verbal",
        explanation: "Sujeito não fica claro.",
        possibleCorrection: "Em ti, esperança e graça encontrei.",
        alternativeCorrection: "Meu coração encontrou em ti esperança e graça.",
        meaningChangeNote: "Ambas preservam o sentido original.",
        severity: "media",
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "ia",
      },
    ],
    compositionFindings: [],
    chorusAnalysis: { present: false, candidatePhrases: [] },
    rhymeFindings: [],
    prosodyFindings: [],
    mood: {
      perceivedFunctions: ["reflexiva"],
      lyricalEmotions: ["contemplativa"],
      textualEnergy: "constante",
      movementDescription: "Sem observações de produção adicionais para este texto.",
      probableStyleHypotheses: [],
      confidence: "medium",
      disclaimer: "Esta classificação considera apenas a letra.",
    },
    congregational: { applicable: false },
    composerQuestions: [],
    findings: [],
    limitations: ["Esta análise considerou apenas o texto da letra."],
    disclaimers: [],
    sectionStatus: {},
    topPriorities: [
      'Corrigir "mao" para "mão".',
      'Reescrever "Esperança e graça em ti encontrou".',
    ],
    narrativeConsistencyIssues: [
      'A letra alterna entre primeira pessoa do singular e do plural sem transição clara.',
    ],
    portugueseSummary: "Revisão detalhada da letra.",
    ...overrides,
  };
}

describe("buildFinalReport", () => {
  it("surfaces topPriorities, ordered, capped implicitly by the merge step", () => {
    const report = buildFinalReport(song(), version(), result());
    expect(report.topPriorities).toEqual([
      'Corrigir "mao" para "mão".',
      'Reescrever "Esperança e graça em ti encontrou".',
    ]);
  });

  it("formats each grammar finding into a detailed, non-vague line-by-line entry", () => {
    const report = buildFinalReport(song(), version(), result());
    const maoEntry = report.lineByLineReview.find((l) => l.includes("Sua mao forte me salvou"));
    expect(maoEntry).toContain("acento circunflexo");
    expect(maoEntry).toContain("Sua mão forte me salvou");
  });

  it("includes both rewrite options and the meaning-change note for an ambiguous line", () => {
    const report = buildFinalReport(song(), version(), result());
    const entry = report.lineByLineReview.find((l) => l.includes("Esperança e graça em ti encontrou"));
    expect(entry).toContain("Em ti, esperança e graça encontrei");
    expect(entry).toContain("Meu coração encontrou em ti esperança e graça");
    expect(entry).toContain("Ambas preservam o sentido original");
  });

  it("builds rewriteSuggestions with both options for a finding, one entry per option", () => {
    const report = buildFinalReport(song(), version(), result());
    expect(report.rewriteSuggestions).toContain(
      '"Esperança e graça em ti encontrou" → "Em ti, esperança e graça encontrei."'
    );
    expect(report.rewriteSuggestions).toContain(
      '"Esperança e graça em ti encontrou" → "Meu coração encontrou em ti esperança e graça."'
    );
  });

  it("surfaces the eu/nós narrative consistency note", () => {
    const report = buildFinalReport(song(), version(), result());
    expect(
      report.narrativeConsistencyNotes.some((n) => n.includes("primeira pessoa"))
    ).toBe(true);
  });

  it("never labels the song as autoajuda anywhere in the report", () => {
    const report = buildFinalReport(song(), version(), result());
    const wholeReportText = JSON.stringify(report).toLowerCase();
    expect(wholeReportText).not.toContain("autoajuda");
  });

  it("does not concatenate structureOverview or emotion with other fields", () => {
    const report = buildFinalReport(song(), version(), result());
    expect(report.structureOverview).toBe("poética");
    expect(report.emotion).toBe("contemplativa");
  });
});
