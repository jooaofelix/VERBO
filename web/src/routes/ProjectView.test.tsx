import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisDoc, SongDoc, VersionDoc, WithId } from "../types/firestore.js";
import { ProjectView } from "./ProjectView.js";

const useAuthMock = vi.fn();
const useSongMock = vi.fn();
const useSongVersionsMock = vi.fn();
const useAnalysisMock = vi.fn();
const createVersionMock = vi.fn();

vi.mock("../hooks/useAuth.js", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../hooks/useSong.js", () => ({ useSong: (id: unknown) => useSongMock(id) }));
vi.mock("../hooks/useSongVersions.js", () => ({ useSongVersions: (id: unknown) => useSongVersionsMock(id) }));
vi.mock("../hooks/useAnalysis.js", () => ({ useAnalysis: (...args: unknown[]) => useAnalysisMock(...args) }));
vi.mock("../repositories/versionsRepository.js", () => ({
  createVersion: (...args: unknown[]) => createVersionMock(...args),
  updateVersion: vi.fn(),
}));

function song(overrides: Partial<WithId<SongDoc>> = {}): WithId<SongDoc> {
  return {
    id: "song-1",
    title: "Minha Canção Antiga",
    language: "pt-BR",
    congregational: false,
    hasAudio: false,
    currentVersionId: "v1",
    userId: "u1",
    status: "active",
    version: 1,
    createdAt: {} as SongDoc["createdAt"],
    updatedAt: {} as SongDoc["updatedAt"],
    ...overrides,
  };
}

function version(overrides: Partial<WithId<VersionDoc>> = {}): WithId<VersionDoc> {
  return {
    id: "v1",
    versionName: "Versão 1",
    lyrics: "Sua mão forte me salvou",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    analysisStatus: "pending",
    userId: "u1",
    status: "active",
    version: 1,
    createdAt: {} as VersionDoc["createdAt"],
    updatedAt: {} as VersionDoc["updatedAt"],
    ...overrides,
  };
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: { uid: "u1" }, loading: false });
  useAnalysisMock.mockReturnValue({ analysis: null, loading: false, error: null });
  createVersionMock.mockResolvedValue("new-version-id");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderProjectView(projectId = "song-1") {
  return render(
    <MemoryRouter initialEntries={[`/projetos/${projectId}`]}>
      <Routes>
        <Route path="/projetos/:projectId" element={<ProjectView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProjectView — loading and error states", () => {
  it("shows 'Carregando seu projeto...' while the song/versions are resolving", () => {
    useSongMock.mockReturnValue({ song: null, loading: true, error: null });
    useSongVersionsMock.mockReturnValue({ versions: [], loading: true, error: null });
    renderProjectView();
    expect(screen.getByText("Carregando seu projeto...")).toBeInTheDocument();
  });

  it("shows a friendly error panel (never a blank screen) when Firestore fails", () => {
    useSongMock.mockReturnValue({ song: null, loading: false, error: new Error("permission-denied") });
    useSongVersionsMock.mockReturnValue({ versions: [], loading: false, error: null });
    renderProjectView();
    expect(screen.getByText(/não foi possível carregar este projeto/i)).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });
});

describe("ProjectView — nonexistent project", () => {
  it("shows the not-found message with both recovery buttons", () => {
    useSongMock.mockReturnValue({ song: null, loading: false, error: null });
    useSongVersionsMock.mockReturnValue({ versions: [], loading: false, error: null });
    renderProjectView();
    expect(
      screen.getByText("Este projeto não foi encontrado ou foi removido.")
    ).toBeInTheDocument();
    expect(screen.getByText("Voltar aos projetos")).toBeInTheDocument();
    expect(screen.getByText("Criar nova análise")).toBeInTheDocument();
  });
});

describe("ProjectView — project without a version", () => {
  it("shows the no-version message with both recovery actions", () => {
    useSongMock.mockReturnValue({ song: song(), loading: false, error: null });
    useSongVersionsMock.mockReturnValue({ versions: [], loading: false, error: null });
    renderProjectView();
    expect(
      screen.getByText("Este projeto ainda não possui uma versão disponível.")
    ).toBeInTheDocument();
    expect(screen.getByText("Criar primeira versão")).toBeInTheDocument();
    expect(screen.getByText("Voltar aos projetos")).toBeInTheDocument();
  });

  it("creates a first version when 'Criar primeira versão' is clicked", async () => {
    useSongMock.mockReturnValue({ song: song(), loading: false, error: null });
    useSongVersionsMock.mockReturnValue({ versions: [], loading: false, error: null });
    renderProjectView();
    fireEvent.click(screen.getByText("Criar primeira versão"));
    expect(createVersionMock).toHaveBeenCalledWith(
      "u1",
      "song-1",
      expect.objectContaining({ versionName: "Versão 1", lyrics: "" })
    );
  });
});

describe("ProjectView — legacy project with a version", () => {
  it("renders the (already-normalized) title, lyrics and version list without crashing", () => {
    useSongMock.mockReturnValue({ song: song({ title: "Título Antigo Recuperado" }), loading: false, error: null });
    useSongVersionsMock.mockReturnValue({ versions: [version()], loading: false, error: null });
    renderProjectView();
    expect(screen.getByText("Título Antigo Recuperado")).toBeInTheDocument();
    expect(screen.getByText("Sua mão forte me salvou")).toBeInTheDocument();
    expect(screen.getByText("Esta versão ainda não tem uma análise.")).toBeInTheDocument();
  });

  it("shows 'Ver análise completa' linking to the version page when a report exists", () => {
    useSongMock.mockReturnValue({ song: song(), loading: false, error: null });
    useSongVersionsMock.mockReturnValue({
      versions: [version({ currentAnalysisId: "a1", analysisStatus: "completed" })],
      loading: false,
      error: null,
    });
    const analysisDoc: WithId<AnalysisDoc> = {
      id: "a1",
      versionId: "v1",
      mode: "live",
      result: {
        id: "a1",
        createdAt: new Date().toISOString(),
        revisionMode: "completa",
        overview: {
          perceivedCentralMessage: "Um testemunho de fidelidade.",
          compositionType: "poética",
          mainEmotion: "contemplativa",
          emotionalMovement: "poética",
          likelyAudience: "Geral",
          likelyUsageContext: "culto",
          strengths: ["Progressão emocional clara."],
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
          pointOfView: { dominantPerson: "1ª pessoa", whoSpeaks: "eu", toWhom: "Deus", shifts: [] },
        },
        grammarFindings: [],
        compositionFindings: [],
        chorusAnalysis: { present: false, candidatePhrases: [] },
        rhymeFindings: [],
        prosodyFindings: [],
        mood: {
          perceivedFunctions: ["reflexiva"],
          lyricalEmotions: ["contemplativa"],
          textualEnergy: "constante",
          movementDescription: "N/A",
          probableStyleHypotheses: [],
          confidence: "medium",
          disclaimer: "N/A",
        },
        congregational: { applicable: false },
        composerQuestions: [],
        findings: [],
        limitations: [],
        disclaimers: [],
        sectionStatus: {},
        topPriorities: [],
        narrativeConsistencyIssues: [],
      },
      userId: "u1",
      status: "completed",
      createdAt: {} as AnalysisDoc["createdAt"],
      updatedAt: {} as AnalysisDoc["updatedAt"],
    };
    useAnalysisMock.mockReturnValue({ analysis: analysisDoc, loading: false, error: null });

    renderProjectView();
    expect(screen.getByText("Um testemunho de fidelidade.")).toBeInTheDocument();
    const link = screen.getByText("Ver análise completa").closest("a");
    expect(link).toHaveAttribute("href", "/projetos/song-1/versoes/v1");
  });
});
