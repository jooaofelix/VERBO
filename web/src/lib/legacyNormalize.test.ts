import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { normalizeLegacyAnalysis, normalizeLegacyProject, normalizeLegacyVersion } from "./legacyNormalize.js";

describe("normalizeLegacyProject", () => {
  it("returns the current shape unchanged when the document already matches it", () => {
    const project = normalizeLegacyProject("song-1", {
      title: "Minha Canção",
      author: "Fulano",
      language: "pt-BR",
      congregational: true,
      hasAudio: false,
      currentVersionId: "v1",
      userId: "u1",
      status: "active",
      version: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    expect(project.title).toBe("Minha Canção");
    expect(project.author).toBe("Fulano");
  });

  it("falls back to songTitle when title is missing", () => {
    const project = normalizeLegacyProject("song-1", { songTitle: "Título Antigo", userId: "u1" });
    expect(project.title).toBe("Título Antigo");
  });

  it("falls back to name when neither title nor songTitle is present", () => {
    const project = normalizeLegacyProject("song-1", { name: "Nome Antigo", userId: "u1" });
    expect(project.title).toBe("Nome Antigo");
  });

  it("uses a safe default title when nothing is present", () => {
    const project = normalizeLegacyProject("song-1", {});
    expect(project.title).toBe("Composição sem título");
  });

  it("handles a completely undefined/missing document without throwing", () => {
    expect(() => normalizeLegacyProject("song-1", undefined)).not.toThrow();
    const project = normalizeLegacyProject("song-1", undefined);
    expect(project.id).toBe("song-1");
    expect(project.status).toBe("active");
  });

  it("converts a plain {seconds,nanoseconds} object into a real Timestamp", () => {
    const project = normalizeLegacyProject("song-1", {
      title: "X",
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    });
    expect(project.createdAt).toBeInstanceOf(Timestamp);
  });

  it("converts an ISO date string timestamp", () => {
    const project = normalizeLegacyProject("song-1", { title: "X", createdAt: "2023-01-01T00:00:00Z" });
    expect(project.createdAt).toBeInstanceOf(Timestamp);
    expect(project.createdAt.toDate().getFullYear()).toBe(2023);
  });
});

describe("normalizeLegacyVersion", () => {
  it("falls back to a default context and empty sections when both are absent", () => {
    const version = normalizeLegacyVersion("v1", { lyrics: "Letra qualquer" });
    expect(version.sections).toEqual([]);
    expect(version.context.theologicalTradition).toBe("nao_selecionar");
    expect(version.context.desiredChangeLevel).toBe("refinar_mantendo_voz");
    expect(version.context.bibleReferencesProvidedByUser).toEqual([]);
  });

  it("reads lyrics from alternate field names", () => {
    expect(normalizeLegacyVersion("v1", { text: "Texto antigo" }).lyrics).toBe("Texto antigo");
    expect(normalizeLegacyVersion("v1", { content: "Conteúdo antigo" }).lyrics).toBe("Conteúdo antigo");
  });

  it("reads currentAnalysisId from the legacy 'analysisId' field", () => {
    const version = normalizeLegacyVersion("v1", { analysisId: "a1" });
    expect(version.currentAnalysisId).toBe("a1");
    expect(version.analysisStatus).toBe("completed");
  });

  it("defaults analysisStatus to 'pending' when there is no analysis id at all", () => {
    const version = normalizeLegacyVersion("v1", {});
    expect(version.analysisStatus).toBe("pending");
    expect(version.currentAnalysisId).toBeUndefined();
  });

  it("never throws on a completely empty/missing document", () => {
    expect(() => normalizeLegacyVersion("v1", undefined)).not.toThrow();
    const version = normalizeLegacyVersion("v1", undefined);
    expect(version.lyrics).toBe("");
    expect(version.versionName).toBe("Versão");
  });
});

describe("normalizeLegacyAnalysis", () => {
  it("returns null when there is no usable result — treated as 'no report yet', not a crash", () => {
    expect(normalizeLegacyAnalysis("a1", {})).toBeNull();
    expect(normalizeLegacyAnalysis("a1", undefined)).toBeNull();
    expect(normalizeLegacyAnalysis("a1", { versionId: "v1" })).toBeNull();
  });

  it("normalizes a valid legacy analysis document", () => {
    const analysis = normalizeLegacyAnalysis("a1", {
      versionId: "v1",
      mode: "demo",
      result: { overview: { perceivedCentralMessage: "x" } },
      userId: "u1",
    });
    expect(analysis).not.toBeNull();
    expect(analysis?.mode).toBe("demo");
    expect(analysis?.result.sectionStatus).toEqual({});
  });
});
