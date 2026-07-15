import type { AnalysisResult, SongContextInput, SongSection } from "@verbo/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song, SongVersion } from "./types.js";

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface NewVersionInput {
  lyrics: string;
  sections: SongSection[];
  context: SongContextInput;
  versionName?: string;
  sourceVersionId?: string;
  authorNotes?: string;
}

interface SongsState {
  songs: Record<string, Song>;
  createSong: (title: string, author: string | undefined, version: NewVersionInput) => { songId: string; versionId: string };
  addVersion: (songId: string, version: NewVersionInput) => string;
  updateVersion: (songId: string, versionId: string, patch: Partial<SongVersion>) => void;
  setVersionAnalysis: (
    songId: string,
    versionId: string,
    analysis: AnalysisResult,
    mode: "live" | "demo"
  ) => void;
  setVersionAnalysisError: (songId: string, versionId: string, error: string) => void;
  renameSong: (songId: string, title: string, author?: string) => void;
  deleteSong: (songId: string) => void;
  setCurrentVersion: (songId: string, versionId: string) => void;
  toggleApproved: (songId: string, versionId: string) => void;
  setFindingDecision: (
    songId: string,
    versionId: string,
    findingId: string,
    decision: "accepted" | "ignored" | undefined
  ) => void;
}

function makeVersion(input: NewVersionInput, index: number): SongVersion {
  return {
    id: id("ver"),
    versionName: input.versionName || `Versão ${index}`,
    createdAt: new Date().toISOString(),
    lyrics: input.lyrics,
    sections: input.sections,
    context: input.context,
    authorNotes: input.authorNotes,
    sourceVersionId: input.sourceVersionId,
  };
}

export const useSongsStore = create<SongsState>()(
  persist(
    (set, get) => ({
      songs: {},

      createSong: (title, author, versionInput) => {
        const version = makeVersion(versionInput, 1);
        const songId = id("song");
        const now = new Date().toISOString();
        const song: Song = {
          id: songId,
          title: title || "Composição sem título",
          author,
          createdAt: now,
          updatedAt: now,
          currentVersionId: version.id,
          versionOrder: [version.id],
          versions: { [version.id]: version },
        };
        set((state) => ({ songs: { ...state.songs, [songId]: song } }));
        return { songId, versionId: version.id };
      },

      addVersion: (songId, versionInput) => {
        const song = get().songs[songId];
        if (!song) throw new Error("Composição não encontrada.");
        const version = makeVersion(versionInput, song.versionOrder.length + 1);
        set((state) => ({
          songs: {
            ...state.songs,
            [songId]: {
              ...song,
              updatedAt: new Date().toISOString(),
              currentVersionId: version.id,
              versionOrder: [...song.versionOrder, version.id],
              versions: { ...song.versions, [version.id]: version },
            },
          },
        }));
        return version.id;
      },

      updateVersion: (songId, versionId, patch) => {
        set((state) => {
          const song = state.songs[songId];
          if (!song || !song.versions[versionId]) return state;
          return {
            songs: {
              ...state.songs,
              [songId]: {
                ...song,
                updatedAt: new Date().toISOString(),
                versions: {
                  ...song.versions,
                  [versionId]: { ...song.versions[versionId], ...patch },
                },
              },
            },
          };
        });
      },

      setVersionAnalysis: (songId, versionId, analysis, mode) => {
        get().updateVersion(songId, versionId, { analysis, analysisMode: mode, analysisError: undefined });
      },

      setVersionAnalysisError: (songId, versionId, error) => {
        get().updateVersion(songId, versionId, { analysisError: error });
      },

      renameSong: (songId, title, author) => {
        set((state) => {
          const song = state.songs[songId];
          if (!song) return state;
          return {
            songs: {
              ...state.songs,
              [songId]: { ...song, title, author, updatedAt: new Date().toISOString() },
            },
          };
        });
      },

      deleteSong: (songId) => {
        set((state) => {
          const { [songId]: _removed, ...rest } = state.songs;
          return { songs: rest };
        });
      },

      setCurrentVersion: (songId, versionId) => {
        set((state) => {
          const song = state.songs[songId];
          if (!song) return state;
          return { songs: { ...state.songs, [songId]: { ...song, currentVersionId: versionId } } };
        });
      },

      toggleApproved: (songId, versionId) => {
        set((state) => {
          const song = state.songs[songId];
          const version = song?.versions[versionId];
          if (!song || !version) return state;
          return {
            songs: {
              ...state.songs,
              [songId]: {
                ...song,
                versions: {
                  ...song.versions,
                  [versionId]: { ...version, approved: !version.approved },
                },
              },
            },
          };
        });
      },
      setFindingDecision: (songId, versionId, findingId, decision) => {
        set((state) => {
          const song = state.songs[songId];
          const version = song?.versions[versionId];
          if (!song || !version) return state;
          const nextDecisions = { ...(version.findingDecisions ?? {}) };
          if (decision) {
            nextDecisions[findingId] = decision;
          } else {
            delete nextDecisions[findingId];
          }
          return {
            songs: {
              ...state.songs,
              [songId]: {
                ...song,
                versions: {
                  ...song.versions,
                  [versionId]: { ...version, findingDecisions: nextDecisions },
                },
              },
            },
          };
        });
      },
    }),
    { name: "verbo-e-cancao:songs" }
  )
);
