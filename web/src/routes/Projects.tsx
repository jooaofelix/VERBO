import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LegacyImportBanner } from "../components/LegacyImportBanner.js";
import { ErrorState } from "../components/StateViews.js";
import { useSongs } from "../hooks/useSongs.js";
import type { SongDoc, WithId } from "../types/firestore.js";

type Filter = "todos" | "com_analise" | "sem_analise" | "recentes";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const FILTERS: Array<[Filter, string]> = [
  ["todos", "Todos"],
  ["com_analise", "Com análise"],
  ["sem_analise", "Sem análise"],
  ["recentes", "Atualizados recentemente"],
];

function matchesFilter(song: WithId<SongDoc>, filter: Filter): boolean {
  switch (filter) {
    case "com_analise":
      return Boolean(song.lastAnalysisSummary);
    case "sem_analise":
      return !song.lastAnalysisSummary;
    case "recentes": {
      const updatedAt = song.updatedAt?.toDate?.();
      return Boolean(updatedAt && Date.now() - updatedAt.getTime() <= RECENT_WINDOW_MS);
    }
    case "todos":
    default:
      return true;
  }
}

export function Projects() {
  const { songs, loading, error } = useSongs();
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return songs
      .filter((s) => matchesFilter(s, filter))
      .filter((s) => !query || s.title.toLowerCase().includes(query));
  }, [songs, filter, search]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <LegacyImportBanner onImported={() => window.location.reload()} />

      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Seus projetos</h1>
        <Link
          to="/analises/nova"
          className="rounded-lg bg-verse-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-verse-500"
        >
          Nova análise
        </Link>
      </div>

      <input
        type="search"
        placeholder="Buscar por nome da música..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Buscar por nome da música"
        className="mt-4 w-full rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === value
                ? "bg-verse-600 text-white"
                : "bg-ink-800/5 text-ink-700/70 dark:bg-parchment-50/5 dark:text-parchment-100/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-700/60 dark:text-parchment-100/50">Carregando...</p>
      ) : error ? (
        <ErrorState message="Não foi possível carregar seus projetos agora." />
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-4xl">📖</p>
          <h2 className="font-display text-xl font-semibold">Sua biblioteca está vazia</h2>
          <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
            Cole ou escreva a letra de uma composição para receber a primeira análise.
          </p>
          <Link
            to="/analises/nova"
            className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
          >
            Nova análise
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-700/60 dark:text-parchment-100/50">
          Nenhum projeto encontrado com esse filtro ou busca.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {filtered.map((song) => (
            <li key={song.id}>
              <Link
                to={`/projetos/${song.id}`}
                className="block rounded-xl border border-ink-800/10 bg-white/60 p-4 transition hover:border-verse-500/40 dark:border-parchment-50/10 dark:bg-ink-900/50"
              >
                <p className="font-medium">{song.title}</p>
                {song.author && (
                  <p className="text-xs text-ink-700/60 dark:text-parchment-100/50">{song.author}</p>
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
      )}
    </div>
  );
}
