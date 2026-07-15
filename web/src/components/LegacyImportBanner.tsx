import { useState } from "react";
import { createSong } from "../repositories/songsRepository.js";
import { createVersion } from "../repositories/versionsRepository.js";
import { useAuth } from "../hooks/useAuth.js";
import {
  dismissLegacyImport,
  markLegacyImportDone,
  readLegacySongs,
  type LegacySong,
} from "../lib/legacyImport.js";

export function LegacyImportBanner({ onImported }: { onImported: () => void }) {
  const { user } = useAuth();
  const [songs] = useState<LegacySong[]>(() => readLegacySongs());
  const [importing, setImporting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (songs.length === 0 || dismissed || !user) return null;

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      for (const song of songs) {
        const songId = await createSong(user!.uid, {
          title: song.title,
          author: song.author,
          congregational: false,
          hasAudio: false,
        });
        for (const versionId of song.versionOrder) {
          const version = song.versions[versionId];
          if (!version) continue;
          await createVersion(user!.uid, songId, {
            versionName: version.versionName,
            lyrics: version.lyrics,
            sections: version.sections,
            context: version.context,
            authorNotes: version.authorNotes,
          });
        }
      }
      markLegacyImportDone();
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível importar os dados antigos.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-verse-500/30 bg-verse-500/10 p-4 text-sm">
      <p className="font-medium">Encontramos composições salvas neste navegador</p>
      <p className="mt-1 text-ink-700/70 dark:text-parchment-100/60">
        {songs.length} {songs.length === 1 ? "composição foi encontrada" : "composições foram encontradas"}{" "}
        de uma versão anterior deste app (armazenada apenas localmente, sem conta). Deseja importá-las
        para sua conta? As letras e versões serão copiadas — análises antigas precisarão ser refeitas.
      </p>
      {error && <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="rounded-lg bg-verse-600 px-4 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {importing ? "Importando..." : "Importar"}
        </button>
        <button
          type="button"
          onClick={() => {
            dismissLegacyImport();
            setDismissed(true);
          }}
          className="rounded-lg border border-ink-800/15 px-4 py-1.5 dark:border-parchment-50/15"
        >
          Ignorar
        </button>
      </div>
    </div>
  );
}
