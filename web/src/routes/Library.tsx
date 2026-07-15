import { Link } from "react-router-dom";
import { LegacyImportBanner } from "../components/LegacyImportBanner.js";
import { useSongs } from "../hooks/useSongs.js";

export function Library() {
  const { songs, loading } = useSongs();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <LegacyImportBanner onImported={() => window.location.reload()} />

      {loading ? (
        <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">Carregando...</p>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-4xl">📖</p>
          <h1 className="font-display text-xl font-semibold">Sua biblioteca está vazia</h1>
          <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
            Cole ou escreva a letra de uma composição para receber a primeira análise.
          </p>
          <Link
            to="/nova"
            className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
          >
            Nova análise
          </Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-xl font-semibold">Seus projetos</h1>
          <p className="mt-1 text-sm text-ink-700/60 dark:text-parchment-100/50">
            Sincronizados com sua conta — {songs.length}{" "}
            {songs.length === 1 ? "composição" : "composições"}.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {songs.map((song) => (
              <li key={song.id}>
                <Link
                  to={
                    song.currentVersionId
                      ? `/musicas/${song.id}/versoes/${song.currentVersionId}`
                      : `/musicas/${song.id}/versoes/`
                  }
                  className="block rounded-xl border border-ink-800/10 bg-white/60 p-4 transition hover:border-verse-500/40 dark:border-parchment-50/10 dark:bg-ink-900/50"
                >
                  <p className="font-medium">{song.title}</p>
                  {song.author && (
                    <p className="text-xs text-ink-700/60 dark:text-parchment-100/50">
                      {song.author}
                    </p>
                  )}
                  {song.lastAnalysisSummary && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-700/70 dark:text-parchment-100/60">
                      {song.lastAnalysisSummary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
