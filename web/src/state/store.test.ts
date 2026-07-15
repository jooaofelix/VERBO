import type { AnalysisResult } from "@verbo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useSongsStore } from "./store.js";

const baseContext = {
  theologicalTradition: "nao_selecionar" as const,
  desiredChangeLevel: "refinar_mantendo_voz" as const,
  bibleReferencesProvidedByUser: [],
};

function minimalAnalysisResult(): AnalysisResult {
  return {
    id: "a1",
    createdAt: new Date().toISOString(),
    revisionMode: "completa",
    overview: {
      perceivedCentralMessage: "msg",
      compositionType: "tipo",
      mainEmotion: "esperança",
      emotionalMovement: "crescente",
      likelyAudience: "geral",
      likelyUsageContext: "devocional",
      strengths: ["forte"],
      attentionPoints: [],
      consistencyWithStatedIntent: "consistente",
      consistencyExplanation: "ok",
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
      narrativeMap: { structureType: "declarativa" },
      pointOfView: { dominantPerson: "1a pessoa", whoSpeaks: "eu", toWhom: "Deus", shifts: [] },
    },
    grammarFindings: [],
    compositionFindings: [],
    chorusAnalysis: { present: false, candidatePhrases: [] },
    prosodyFindings: [],
    rhymeFindings: [],
    mood: {
      perceivedFunctions: ["devocional"],
      lyricalEmotions: ["esperancosa"],
      textualEnergy: "media",
      movementDescription: "estável",
      probableStyleHypotheses: [],
      confidence: "low",
      disclaimer: "estimativa",
    },
    congregational: { applicable: false },
    composerQuestions: [],
    findings: [],
    limitations: [],
    disclaimers: [],
  };
}

beforeEach(() => {
  localStorage.clear();
  useSongsStore.setState({ songs: {} });
});

describe("useSongsStore", () => {
  it("creates a song with a first version", () => {
    const { songId, versionId } = useSongsStore.getState().createSong("Minha música", "Autor", {
      lyrics: "Verso 1",
      sections: [],
      context: baseContext,
    });
    const song = useSongsStore.getState().songs[songId];
    expect(song.title).toBe("Minha música");
    expect(song.currentVersionId).toBe(versionId);
    expect(song.versionOrder).toEqual([versionId]);
  });

  it("adds a second version without touching the first", () => {
    const { songId } = useSongsStore.getState().createSong("Música", undefined, {
      lyrics: "V1",
      sections: [],
      context: baseContext,
    });
    const v2 = useSongsStore.getState().addVersion(songId, {
      lyrics: "V2",
      sections: [],
      context: baseContext,
    });
    const song = useSongsStore.getState().songs[songId];
    expect(song.versionOrder).toHaveLength(2);
    expect(song.versions[v2].lyrics).toBe("V2");
    expect(song.versions[song.versionOrder[0]].lyrics).toBe("V1");
  });

  it("attaches an analysis result to a version", () => {
    const { songId, versionId } = useSongsStore.getState().createSong("Música", undefined, {
      lyrics: "V1",
      sections: [],
      context: baseContext,
    });
    useSongsStore.getState().setVersionAnalysis(songId, versionId, minimalAnalysisResult(), "demo");
    const version = useSongsStore.getState().songs[songId].versions[versionId];
    expect(version.analysis?.overview.perceivedCentralMessage).toBe("msg");
    expect(version.analysisMode).toBe("demo");
  });

  it("tracks accept/ignore decisions per finding, independent of other versions", () => {
    const { songId, versionId } = useSongsStore.getState().createSong("Música", undefined, {
      lyrics: "V1",
      sections: [],
      context: baseContext,
    });
    useSongsStore.getState().setFindingDecision(songId, versionId, "finding-1", "accepted");
    let version = useSongsStore.getState().songs[songId].versions[versionId];
    expect(version.findingDecisions?.["finding-1"]).toBe("accepted");

    useSongsStore.getState().setFindingDecision(songId, versionId, "finding-1", undefined);
    version = useSongsStore.getState().songs[songId].versions[versionId];
    expect(version.findingDecisions?.["finding-1"]).toBeUndefined();
  });

  it("deletes a song entirely", () => {
    const { songId } = useSongsStore.getState().createSong("Música", undefined, {
      lyrics: "V1",
      sections: [],
      context: baseContext,
    });
    useSongsStore.getState().deleteSong(songId);
    expect(useSongsStore.getState().songs[songId]).toBeUndefined();
  });
});
