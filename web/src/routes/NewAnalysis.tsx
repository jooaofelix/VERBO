import type { RevisionMode, SongContextInput, SongSection } from "@verbo/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveAnalysisResult } from "../repositories/analysesRepository.js";
import { createSong } from "../repositories/songsRepository.js";
import { createVersion } from "../repositories/versionsRepository.js";
import { ContextForm } from "../components/ContextForm.js";
import { LyricsEditor } from "../components/LyricsEditor.js";
import { useAuth } from "../hooks/useAuth.js";
import { analyzeLyrics } from "../services/worker/client.js";

const REVISION_MODES: Array<{ value: RevisionMode; label: string; description: string }> = [
  { value: "completa", label: "Revisão completa", description: "Combina todas as análises abaixo." },
  { value: "rapida", label: "Revisão rápida", description: "Mensagem, referências, erros e 3 sugestões prioritárias." },
  { value: "biblica_teologica", label: "Bíblica e teológica", description: "Referências, contexto, doutrina e tradições." },
  { value: "composicao", label: "Composição", description: "Estrutura, refrão, narrativa, métrica e rimas." },
  { value: "portugues", label: "Português", description: "Ortografia, gramática, conjugação e clareza." },
  { value: "congregacional", label: "Congregacional", description: "Clareza coletiva, cantabilidade e repetição." },
];

const DEFAULT_CONTEXT: SongContextInput = {
  theologicalTradition: "nao_selecionar",
  desiredChangeLevel: "refinar_mantendo_voz",
  bibleReferencesProvidedByUser: [],
  isChristian: true,
};

export function NewAnalysis() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [sections, setSections] = useState<SongSection[]>([]);
  const [context, setContext] = useState<SongContextInput>(DEFAULT_CONTEXT);
  const [revisionMode, setRevisionMode] = useState<RevisionMode>("completa");
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!lyrics.trim()) {
      setError("Cole ou escreva a letra antes de analisar.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const songId = await createSong(user.uid, {
        title,
        author: author || undefined,
        congregational: context.usageContext === "congregacional",
        hasAudio: false,
      });

      const versionId = await createVersion(user.uid, songId, {
        versionName: "Versão 1",
        lyrics,
        sections,
        context,
      });

      // The Worker is stateless — it only verifies the ID token and runs
      // the analysis, it never touches Firestore. The client persists the
      // result itself, exactly like any other write in this app.
      const { mode, result } = await analyzeLyrics({
        lyrics,
        sections,
        context,
        revisionMode,
        bibleTranslationPreference: "dominio_publico_almeida",
      });
      await saveAnalysisResult(user.uid, songId, versionId, mode, result);

      navigate(`/projetos/${songId}/versoes/${versionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a análise agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Nova análise</h1>
      <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
        Apenas a letra é obrigatória. O contexto ajuda, mas você pode pular direto para a análise.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Título (opcional)</span>
            <input
              className="rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm dark:border-parchment-50/15 dark:bg-ink-900/60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Autor (opcional)</span>
            <input
              className="rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm dark:border-parchment-50/15 dark:bg-ink-900/60"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowContext((v) => !v)}
            className="text-sm font-medium text-verse-600 dark:text-verse-400"
          >
            {showContext ? "▾" : "▸"} Intenção da canção (contexto opcional)
          </button>
          {showContext && (
            <div className="mt-3">
              <ContextForm value={context} onChange={(patch) => setContext((c) => ({ ...c, ...patch }))} />
            </div>
          )}
        </div>

        <LyricsEditor
          lyrics={lyrics}
          onLyricsChange={setLyrics}
          sections={sections}
          onSectionsChange={setSections}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Modo de revisão</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REVISION_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                  revisionMode === mode.value
                    ? "border-verse-500 bg-verse-500/10"
                    : "border-ink-800/15 dark:border-parchment-50/15"
                }`}
              >
                <input
                  type="radio"
                  name="revisionMode"
                  className="mr-2"
                  checked={revisionMode === mode.value}
                  onChange={() => setRevisionMode(mode.value)}
                />
                <span className="font-medium">{mode.label}</span>
                <p className="mt-0.5 pl-5 text-xs text-ink-700/60 dark:text-parchment-100/50">
                  {mode.description}
                </p>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-verse-600 px-5 py-3 font-medium text-white transition hover:bg-verse-500 disabled:opacity-50"
        >
          {loading ? "Analisando..." : "Analisar letra"}
        </button>
      </form>
    </div>
  );
}
