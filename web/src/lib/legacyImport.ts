import type { SongContextInput, SongSection } from "@verbo/shared";

const LEGACY_STORAGE_KEY = "verbo-e-cancao:songs";
const IMPORT_DONE_KEY = "verbo-e-cancao:legacy-import-done";

interface LegacyVersion {
  versionName: string;
  lyrics: string;
  sections: SongSection[];
  context: SongContextInput;
  authorNotes?: string;
}

interface LegacySong {
  title: string;
  author?: string;
  versionOrder: string[];
  versions: Record<string, LegacyVersion>;
}

interface LegacyState {
  state?: { songs?: Record<string, LegacySong> };
}

/**
 * The pre-Firebase version of this app stored everything in
 * localStorage (zustand persist, key "verbo-e-cancao:songs"). This reads
 * that old data without depending on zustand (which the app no longer
 * uses), so a returning visitor can be offered a one-time import into
 * Firestore. Note: legacy *analysis results* are intentionally not carried
 * over — analyses are now written exclusively by Cloud Functions, so an
 * imported song simply starts with no analysis until the user re-runs one.
 */
export function readLegacySongs(): LegacySong[] {
  if (localStorage.getItem(IMPORT_DONE_KEY) === "1") return [];

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: LegacyState = JSON.parse(raw);
    const songs = parsed.state?.songs;
    return songs ? Object.values(songs) : [];
  } catch {
    return [];
  }
}

export function markLegacyImportDone(): void {
  localStorage.setItem(IMPORT_DONE_KEY, "1");
}

export function dismissLegacyImport(): void {
  markLegacyImportDone();
}

export type { LegacySong, LegacyVersion };
