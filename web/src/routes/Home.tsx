import { Link } from "react-router-dom";
import { ErrorState } from "../components/StateViews.js";
import { useAuth } from "../hooks/useAuth.js";
import { useSongVersions } from "../hooks/useSongVersions.js";
import { useSongs } from "../hooks/useSongs.js";
import type { SongDoc, WithId } from "../types/firestore.js";

const ANALYSIS_STATUS_LABEL: Record<string, string> = {
  completed: "Análise concluída",
  pending: "Sem análise ainda",
  error: "Análise com erro",
};

function firstNameOf(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0];
  return first || "compositor(a)";
}

function RecentProjectCard({ song }: { song: WithId<SongDoc> }) {
  const { versions, loading } = useSongVersions(song.id);
  const currentVersion =
    versions.find((v) => v.id === song.currentVersionId) ?? versions[versions.length - 1];
  const statusLabel = currentVersion
    ? (ANALYSIS_STATUS_LABEL[currentVersion.analysisStatus ?? "pending"] ?? "Sem análise ainda")
    : "Sem versão ainda";
  const updatedAt = song.updatedAt?.toDate?.();

  return (
    <li className="rounded-xl border border-ink-800/10 bg-white/60 p-4 dark:border-parchment-50/10 dark:bg-ink-900/50">
      <p className="font-medium">{song.title}</p>
      <p className="mt-1 text-xs text-ink-700/60 dark:text-parchment-100/50">
        {updatedAt ? `Atualizado em ${updatedAt.toLocaleDateString("pt-BR")}` : "Data indisponível"}
        {" · "}
        {loading ? "carregando versões..." : `${versions.length} ${versions.length === 1 ? "versão" : "versões"}`}
        {" · "}
        {statusLabel}
      </p>
      <Link
        to={`/projetos/${song.id}`}
        className="mt-2 inline-block text-sm font-medium text-verse-600 underline dark:text-verse-400"
      >
        Abrir projeto
      </Link>
    </li>
  );
}

export function Home() {
  const { user } = useAuth();
  const { songs, loading, error } = useSongs();
  const recentProjects = songs.slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-semibold">Olá, {firstNameOf(user?.displayName)}</h1>
      <p className="mt-1 text-ink-700/70 dark:text-parchment-100/60">
        Vamos desenvolver sua próxima canção?
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-800/10 bg-white/60 p-5 dark:border-parchment-50/10 dark:bg-ink-900/50">
          <h2 className="font-display text-lg font-semibold">Criar nova análise</h2>
          <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
            Cole uma letra e receba uma revisão detalhada.
          </p>
          <Link
            to="/analises/nova"
            className="mt-3 inline-block rounded-xl bg-verse-600 px-4 py-2 text-sm font-medium text-white hover:bg-verse-500"
          >
            Começar análise
          </Link>
        </div>
        <div className="rounded-xl border border-ink-800/10 bg-white/60 p-5 dark:border-parchment-50/10 dark:bg-ink-900/50">
          <h2 className="font-display text-lg font-semibold">Meus projetos</h2>
          <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
            Acesse suas músicas, versões e análises anteriores.
          </p>
          <Link
            to="/projetos"
            className="mt-3 inline-block rounded-xl border border-verse-500/40 px-4 py-2 text-sm font-medium text-verse-600 dark:text-verse-400"
          >
            Ver projetos
          </Link>
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Projetos recentes</h2>

      {loading ? (
        <p className="mt-3 text-sm text-ink-700/60 dark:text-parchment-100/50">Carregando...</p>
      ) : error ? (
        <ErrorState message="Não foi possível carregar seus projetos recentes agora." />
      ) : recentProjects.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/70 dark:text-parchment-100/60">
          Você ainda não criou nenhuma composição — comece pela primeira análise acima.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {recentProjects.map((song) => (
            <RecentProjectCard key={song.id} song={song} />
          ))}
        </ul>
      )}
    </div>
  );
}
