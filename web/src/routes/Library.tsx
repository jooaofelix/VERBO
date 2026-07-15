import { Link } from "react-router-dom";
import { useSongsStore } from "../state/store.js";

export function Library() {
  const songs = useSongsStore((s) => s.songs);
  const list = Object.values(songs).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (list.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
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
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Seus projetos</h1>
      <p className="mt-1 text-sm text-ink-700/60 dark:text-parchment-100/50">
        Salvos apenas neste navegador — {list.length}{" "}
        {list.length === 1 ? "composição" : "composições"}.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {list.map((song) => {
          const currentVersion = song.versions[song.currentVersionId];
          return (
            <li key={song.id}>
              <Link
                to={`/musicas/${song.id}/versoes/${song.currentVersionId}`}
                className="block rounded-xl border border-ink-800/10 bg-white/60 p-4 transition hover:border-verse-500/40 dark:border-parchment-50/10 dark:bg-ink-900/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{song.title}</p>
                  <span className="text-xs text-ink-700/50 dark:text-parchment-100/40">
                    {song.versionOrder.length}{" "}
                    {song.versionOrder.length === 1 ? "versão" : "versões"}
                  </span>
                </div>
                {song.author && (
                  <p className="text-xs text-ink-700/60 dark:text-parchment-100/50">
                    {song.author}
                  </p>
                )}
                {currentVersion?.analysis && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-700/70 dark:text-parchment-100/60">
                    {currentVersion.analysis.overview.perceivedCentralMessage}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
