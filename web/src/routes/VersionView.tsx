import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnalysisDashboard } from "../components/AnalysisDashboard.js";
import { SaveStatusIndicator } from "../components/SaveStatusIndicator.js";
import { useAnalysis } from "../hooks/useAnalysis.js";
import { useAuth } from "../hooks/useAuth.js";
import { useDebouncedAutosave } from "../hooks/useDebouncedAutosave.js";
import { useSong } from "../hooks/useSong.js";
import { useSongVersions } from "../hooks/useSongVersions.js";
import { useVersion } from "../hooks/useVersion.js";
import { saveAnalysisResult } from "../repositories/analysesRepository.js";
import { createVersion, updateVersion } from "../repositories/versionsRepository.js";
import { analyzeLyrics } from "../services/worker/client.js";

type Tab = "letra" | "analise" | "versoes";

export function VersionView() {
  // Registered under two route patterns — the canonical /projetos/:projectId/...
  // and the legacy /musicas/:songId/... alias — so accept whichever param is present.
  const { songId: songIdParam, projectId, versionId } = useParams();
  const songId = songIdParam ?? projectId;
  const navigate = useNavigate();
  const { user } = useAuth();

  const { song, loading: songLoading } = useSong(songId);
  const { version, loading: versionLoading } = useVersion(songId, versionId);
  const { versions } = useSongVersions(songId);
  const { analysis } = useAnalysis(songId, version?.currentAnalysisId);

  const [tab, setTab] = useState<Tab>("analise");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lyricsDraft, setLyricsDraft] = useState<string | null>(null);

  const saveStatus = useDebouncedAutosave(lyricsDraft ?? version?.lyrics ?? "", async (lyrics) => {
    if (!user || !songId || !versionId) return;
    await updateVersion(user.uid, songId, versionId, { lyrics });
  });

  if (songLoading || versionLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-ink-700/60 dark:text-parchment-100/50">
        Carregando...
      </div>
    );
  }

  if (!user || !song || !songId || !version || !versionId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p>Composição ou versão não encontrada, ou você não tem acesso a ela.</p>
        <Link to="/projetos" className="mt-3 inline-block text-verse-600 underline dark:text-verse-400">
          Voltar aos projetos
        </Link>
      </div>
    );
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      const { mode, result } = await analyzeLyrics({
        lyrics: version!.lyrics,
        sections: version!.sections,
        context: version!.context,
        revisionMode: "completa",
        bibleTranslationPreference: "dominio_publico_almeida",
      });
      await saveAnalysisResult(user!.uid, songId!, versionId!, mode, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a análise agora.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function duplicateAsNewVersion() {
    const newVersionId = await createVersion(user!.uid, songId!, {
      versionName: `${version!.versionName} (cópia)`,
      lyrics: version!.lyrics,
      sections: version!.sections,
      context: version!.context,
      sourceVersionId: version!.id,
    });
    navigate(`/projetos/${songId}/versoes/${newVersionId}`);
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
          <div>
            <div className="mb-2 flex justify-end">
              <SaveStatusIndicator status={saveStatus} />
            </div>
            <textarea
              className="min-h-[16rem] w-full rounded-xl border border-ink-800/10 bg-white/60 p-4 font-mono text-sm leading-relaxed outline-none focus:border-verse-500 dark:border-parchment-50/10 dark:bg-ink-900/50"
              value={lyricsDraft ?? version.lyrics}
              onChange={(e) => setLyricsDraft(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
              Alterações são salvas automaticamente. Rode uma nova análise para avaliar o texto
              atualizado.
            </p>
          </div>
        )}

        {tab === "analise" &&
          (version.currentAnalysisId && analysis ? (
            <AnalysisDashboard uid={user.uid} song={song} version={version} result={analysis.result} />
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
                {version.analysisStatus === "pending" && !version.currentAnalysisId
                  ? "Esta versão ainda não tem uma análise."
                  : "Carregando análise..."}
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
              {versions.length >= 2 && (
                <Link
                  to={`/projetos/${songId}/comparar`}
                  className="rounded-lg border border-verse-500/40 px-3 py-1.5 text-sm text-verse-600 dark:text-verse-400"
                >
                  Comparar versões
                </Link>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={`rounded-lg border p-3 text-sm ${
                    v.id === versionId
                      ? "border-verse-500/50 bg-verse-500/5"
                      : "border-ink-800/10 dark:border-parchment-50/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/projetos/${songId}/versoes/${v.id}`} className="font-medium hover:underline">
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
                        onClick={() => updateVersion(user.uid, songId, v.id, { approved: !v.approved })}
                        className="underline"
                      >
                        {v.approved ? "Desmarcar aprovação" : "Marcar como aprovada"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
                    {v.analysisStatus === "completed" ? "Análise concluída" : "Sem análise ainda"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
