import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SongDoc, WithId } from "../types/firestore.js";
import { Home } from "./Home.js";

const useAuthMock = vi.fn();
const useSongsMock = vi.fn();
const useSongVersionsMock = vi.fn();

vi.mock("../hooks/useAuth.js", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../hooks/useSongs.js", () => ({ useSongs: () => useSongsMock() }));
vi.mock("../hooks/useSongVersions.js", () => ({ useSongVersions: () => useSongVersionsMock() }));

function song(overrides: Partial<WithId<SongDoc>> = {}): WithId<SongDoc> {
  return {
    id: "song-1",
    title: "Minha Canção",
    language: "pt-BR",
    congregational: false,
    hasAudio: false,
    currentVersionId: "v1",
    userId: "u1",
    status: "active",
    version: 1,
    createdAt: { toDate: () => new Date("2024-01-01") } as unknown as SongDoc["createdAt"],
    updatedAt: { toDate: () => new Date("2024-01-02") } as unknown as SongDoc["updatedAt"],
    ...overrides,
  };
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: { displayName: "Maria Silva", uid: "u1" }, loading: false });
  useSongsMock.mockReturnValue({ songs: [], loading: false, error: null });
  useSongVersionsMock.mockReturnValue({ versions: [], loading: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe("Home — greeting", () => {
  it("greets the user by their first name only", () => {
    renderHome();
    expect(screen.getByText("Olá, Maria")).toBeInTheDocument();
    expect(screen.getByText("Vamos desenvolver sua próxima canção?")).toBeInTheDocument();
  });

  it("falls back to a generic greeting when there is no display name", () => {
    useAuthMock.mockReturnValue({ user: { displayName: null, uid: "u1" }, loading: false });
    renderHome();
    expect(screen.getByText("Olá, compositor(a)")).toBeInTheDocument();
  });
});

describe("Home — main cards", () => {
  it("shows 'Criar nova análise' linking to /analises/nova", () => {
    renderHome();
    const link = screen.getByText("Começar análise").closest("a");
    expect(link).toHaveAttribute("href", "/analises/nova");
  });

  it("shows 'Meus projetos' linking to /projetos", () => {
    renderHome();
    const link = screen.getByText("Ver projetos").closest("a");
    expect(link).toHaveAttribute("href", "/projetos");
  });
});

describe("Home — recent projects", () => {
  it("shows up to 4 recent projects, each with an 'Abrir projeto' link to /projetos/:id", () => {
    useSongsMock.mockReturnValue({
      songs: [song({ id: "s1" }), song({ id: "s2" }), song({ id: "s3" }), song({ id: "s4" }), song({ id: "s5" })],
      loading: false,
      error: null,
    });
    renderHome();
    const links = screen.getAllByText("Abrir projeto");
    expect(links).toHaveLength(4);
    expect(links[0].closest("a")).toHaveAttribute("href", "/projetos/s1");
  });

  it("shows an empty message when there are no projects yet", () => {
    renderHome();
    expect(screen.getByText(/ainda não criou nenhuma composição/i)).toBeInTheDocument();
  });

  it("shows a friendly error instead of a blank screen when loading recent projects fails", () => {
    useSongsMock.mockReturnValue({ songs: [], loading: false, error: new Error("boom") });
    renderHome();
    expect(screen.getByText(/não foi possível carregar seus projetos recentes/i)).toBeInTheDocument();
  });

  it("navigating to a recent project uses the song id in the URL, not in-memory state", () => {
    useSongsMock.mockReturnValue({ songs: [song({ id: "abc-123" })], loading: false, error: null });
    renderHome();
    expect(screen.getByText("Abrir projeto").closest("a")).toHaveAttribute("href", "/projetos/abc-123");
  });
});
