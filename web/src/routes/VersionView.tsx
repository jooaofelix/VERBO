import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analyzeLyrics, ApiError } from "../api/client.js";
import { AnalysisDashboard } from "../components/AnalysisDashboard.js";
import { useSongsStore } from "../state/store.js";

type Tab = "letra" | "analise" | "versoes";

export function VersionView() {
  const { songId, versionId } = useParams();
  const navigate = useNavigate();
  const song = useSongsStore((s) => (songId ? s.songs[songId] : undefined));
  const setVersionAnalysis = useSongsStore((s) => s.setVersionAnalysis);
  const setCurrentVersion = useSongsStore((s) => s.setCurrentVersion);
  const toggleApproved = useSongsStore((s) => s.toggleApproved);
  const addVersion = useSongsStore((s) => s.addVersion);

  const [tab, setTab] = useState<Tab>("analise");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!song || !songId || !versionId || !song.versions[versionId]) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p>Composição ou versão não encontrada neste dispositivo.</p>
        <Link to="/" className="mt-3 inline-block text-verse-600 underline dark:text-verse-400">
          Voltar para a biblioteca
        </Link>
      </div>
    );
  }

  const currentSong = song;
  const version = song.versions[versionId];
  const currentSongId = songId;
  const currentVersionId = versionId;

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await analyzeLyrics({
        songTitle: currentSong.title,
        author: currentSong.author,
        lyrics: version.lyrics,
        sections: version.sections,
        context: version.context,
        revisionMode: "completa",
        bibleTranslationPreference: "dominio_publico_almeida",
      });
      setVersionAnalysis(currentSongId, currentVersionId, response.result, response.mode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir a análise agora.");
    } finally {
      setAnalyzing(false);
    }
  }

  function duplicateAsNewVersion() {
    const newVersionId = addVersion(currentSongId, {
      lyrics: version.lyrics,
      sections: version.sections,
      context: version.context,
      versionName: `${version.versionName} (cópia)`,
      sourceVersionId: version.id,
    });
    navigate(`/musicas/${currentSongId}/versoes/${newVersionId}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">{song.title}</h1>
          {song.author && (
            <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">{song.author}</p>
          )}
        </div>
        <span className="rounded-full bg-ink-800/10 px-2.5 py-1 text-xs dark:bg-parchment-50/10">
          {version.versionName}
        </span>
      </div>

      <div className="mt-4 flex gap-1">
        {(["analise", "letra", "versoes"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === t
                ? "bg-verse-600 text-white"
                : "bg-ink-800/5 text-ink-700/70 dark:bg-parchment-50/5 dark:text-parchment-100/60"
            }`}
          >
            {t === "letra" ? "Letra" : t === "analise" ? "Análise" : "Versões"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "letra" && (
          <div className="rounded-xl border border-ink-800/10 bg-white/60 p-4 dark:border-parchment-50/10 dark:bg-ink-900/50">
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{version.lyrics}</p>
          </div>
        )}

        {tab === "analise" &&
          (version.analysis ? (
            <AnalysisDashboard song={song} version={version} result={version.analysis} />
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
                Esta versão ainda não tem uma análise.
              </p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="button"
                onClick={runAnalysis}
                disabled={analyzing}
                className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
              >
                {analyzing ? "Analisando..." : "Analisar esta versão"}
              </button>
            </div>
          ))}

        {tab === "versoes" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={duplicateAsNewVersion}
                className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
              >
                Duplicar como nova versão
              </button>
              {song.versionOrder.length >= 2 && (
                <Link
                  to={`/musicas/${songId}/comparar`}
                  className="rounded-lg border border-verse-500/40 px-3 py-1.5 text-sm text-verse-600 dark:text-verse-400"
                >
                  Comparar versões
                </Link>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {song.versionOrder.map((vId) => {
                const v = song.versions[vId];
                return (
                  <li
                    key={vId}
                    className={`rounded-lg border p-3 text-sm ${
                      vId === versionId
                        ? "border-verse-500/50 bg-verse-500/5"
                        : "border-ink-800/10 dark:border-parchment-50/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={`/musicas/${songId}/versoes/${vId}`}
                        onClick={() => setCurrentVersion(songId!, vId)}
                        className="font-medium hover:underline"
                      >
                        {v.versionName}
                      </Link>
                      <div className="flex items-center gap-2 text-xs">
                        {v.approved && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
                            Aprovada
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleApproved(songId!, vId)}
                          className="underline"
                        >
                          {v.approved ? "Desmarcar aprovação" : "Marcar como aprovada"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
                      {new Date(v.createdAt).toLocaleString("pt-BR")}
                      {v.analysisMode && ` · análise em modo ${v.analysisMode === "demo" ? "demonstração" : "real"}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
