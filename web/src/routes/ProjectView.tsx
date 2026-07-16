import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState, NotFoundState } from "../components/StateViews.js";
import { useAnalysis } from "../hooks/useAnalysis.js";
import { useAuth } from "../hooks/useAuth.js";
import { useSong } from "../hooks/useSong.js";
import { useSongVersions } from "../hooks/useSongVersions.js";
import { buildFinalReport } from "../lib/report.js";
import { createVersion } from "../repositories/versionsRepository.js";

const ANALYSIS_STATUS_LABEL: Record<string, string> = {
  completed: "Análise concluída",
  pending: "Sem análise ainda",
  error: "Análise com erro",
};

export function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { song, loading: songLoading, error: songError } = useSong(projectId);
  const { versions, loading: versionsLoading, error: versionsError } = useSongVersions(projectId);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);

  const selectedVersion =
    versions.find((v) => v.id === selectedVersionId) ??
    versions.find((v) => v.id === song?.currentVersionId) ??
    versions[versions.length - 1];

  const { analysis } = useAnalysis(projectId, selectedVersion?.currentAnalysisId);

  if (songLoading || versionsLoading) {
    return <LoadingState message="Carregando seu projeto..." />;
  }

  if (songError || versionsError) {
    return (
      <ErrorState
        message="Não foi possível carregar este projeto agora."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!song || !projectId) {
    return (
      <NotFoundState
        message="Este projeto não foi encontrado ou foi removido."
        primaryLabel="Criar nova análise"
        primaryTo="/analises/nova"
      />
    );
  }

  async function handleCreateVersion() {
    if (!user || !projectId) return;
    setCreatingVersion(true);
    try {
      const source = selectedVersion;
      const newVersionId = await createVersion(user.uid, projectId, {
        versionName: source ? `${source.versionName} (cópia)` : "Versão 1",
        lyrics: source?.lyrics ?? "",
        sections: source?.sections ?? [],
        context: source?.context ?? {
          theologicalTradition: "nao_selecionar",
          desiredChangeLevel: "refinar_mantendo_voz",
          bibleReferencesProvidedByUser: [],
        },
        sourceVersionId: source?.id,
      });
      navigate(`/projetos/${projectId}/versoes/${newVersionId}`);
    } finally {
      setCreatingVersion(false);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-display text-xl font-semibold">{song.title}</h1>
        <div className="mt-6 flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-3xl">📝</p>
          <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
            Este projeto ainda não possui uma versão disponível.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleCreateVersion}
              disabled={creatingVersion}
              className="rounded-xl bg-verse-600 px-4 py-2 text-sm font-medium text-white hover:bg-verse-500 disabled:opacity-50"
            >
              {creatingVersion ? "Criando..." : "Criar primeira versão"}
            </button>
            <Link
              to="/projetos"
              className="rounded-xl border border-ink-800/15 px-4 py-2 text-sm font-medium dark:border-parchment-50/15"
            >
              Voltar aos projetos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const report = analysis ? buildFinalReport(song, selectedVersion!, analysis.result) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">{song.title}</h1>
          {song.author && (
            <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">{song.author}</p>
          )}
        </div>
        <Link to="/projetos" className="text-sm text-verse-600 underline dark:text-verse-400">
          Voltar para projetos
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
          Versões
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelectedVersionId(v.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  selectedVersion?.id === v.id
                    ? "bg-verse-600 text-white"
                    : "bg-ink-800/5 text-ink-700/70 dark:bg-parchment-50/5 dark:text-parchment-100/60"
                }`}
              >
                {v.versionName} — {ANALYSIS_STATUS_LABEL[v.analysisStatus ?? "pending"]}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selectedVersion && (
        <>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
              Letra ({selectedVersion.versionName})
            </p>
            <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-ink-800/10 bg-white/60 p-4 font-sans text-sm dark:border-parchment-50/10 dark:bg-ink-900/50">
              {selectedVersion.lyrics || "(sem letra ainda)"}
            </pre>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
              Último relatório
            </p>
            {report ? (
              <div className="mt-1 rounded-xl border border-ink-800/10 bg-white/60 p-4 text-sm dark:border-parchment-50/10 dark:bg-ink-900/50">
                <p>{report.perceivedMessage}</p>
                <Link
                  to={`/projetos/${projectId}/versoes/${selectedVersion.id}`}
                  className="mt-2 inline-block text-sm font-medium text-verse-600 underline dark:text-verse-400"
                >
                  Ver análise completa
                </Link>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
                Esta versão ainda não tem uma análise.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateVersion}
              disabled={creatingVersion}
              className="rounded-xl border border-ink-800/15 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-parchment-50/15"
            >
              {creatingVersion ? "Criando..." : "Nova versão"}
            </button>
            <Link
              to={`/projetos/${projectId}/versoes/${selectedVersion.id}`}
              className="rounded-xl bg-verse-600 px-4 py-2 text-sm font-medium text-white hover:bg-verse-500"
            >
              Nova análise
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
