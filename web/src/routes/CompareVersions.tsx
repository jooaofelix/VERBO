import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSong } from "../hooks/useSong.js";
import { useSongVersions } from "../hooks/useSongVersions.js";
import { callCompareVersions } from "../repositories/analysesRepository.js";

interface ComparisonResult {
  diff: Array<{ text: string; type: "same" | "added" | "removed" }>;
  dimensions: Record<string, { a: unknown; b: unknown }>;
  note: string;
}

const DIMENSION_LABEL: Record<string, string> = {
  consistencyWithStatedIntent: "Consistência com a intenção",
  grammarFindingsCount: "Achados de português",
  bibleReferencesCount: "Referências bíblicas identificadas",
  attentionPointsCount: "Pontos de atenção",
  wordCount: "Palavras na letra",
};

export function CompareVersions() {
  const { songId } = useParams();
  const { song } = useSong(songId);
  const { versions } = useSongVersions(songId);

  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (versions.length >= 2 && !aId && !bId) {
      setAId(versions[versions.length - 2].id);
      setBId(versions[versions.length - 1].id);
    }
  }, [versions, aId, bId]);

  useEffect(() => {
    if (!songId || !aId || !bId || aId === bId) return;
    setLoading(true);
    setError(null);
    callCompareVersions({ songId, versionAId: aId, versionBId: bId })
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível comparar as versões."))
      .finally(() => setLoading(false));
  }, [songId, aId, bId]);

  if (!song) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p>Composição não encontrada.</p>
        <Link to="/" className="mt-3 inline-block text-verse-600 underline dark:text-verse-400">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Comparar versões</h1>
      <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
        A versão mais recente não é automaticamente melhor — compare os fatos e decida.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Versão A</span>
          <select
            className="rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 dark:border-parchment-50/15 dark:bg-ink-900/60"
            value={aId}
            onChange={(e) => setAId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Versão B</span>
          <select
            className="rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 dark:border-parchment-50/15 dark:bg-ink-900/60"
            value={bId}
            onChange={(e) => setBId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <p className="mt-6 text-sm text-ink-700/60 dark:text-parchment-100/50">Comparando...</p>
      )}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">O que mudou no texto</h2>
            <div className="rounded-xl border border-ink-800/10 bg-white/60 p-4 text-sm leading-relaxed dark:border-parchment-50/10 dark:bg-ink-900/50">
              <p className="whitespace-pre-wrap">
                {result.diff.map((t, i) => (
                  <span
                    key={i}
                    className={
                      t.type === "added"
                        ? "bg-emerald-500/25 text-emerald-800 dark:text-emerald-300"
                        : t.type === "removed"
                          ? "bg-rose-500/25 text-rose-800 line-through dark:text-rose-300"
                          : ""
                    }
                  >
                    {t.text}
                  </span>
                ))}
              </p>
            </div>
            <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
              Verde: adicionado em B. Vermelho riscado: removido de A.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Comparação por dimensão</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink-700/50 dark:text-parchment-100/40">
                    <th className="py-1 pr-2">Dimensão</th>
                    <th className="py-1 pr-2">A</th>
                    <th className="py-1">B</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.dimensions).map(([key, value]) => (
                    <tr key={key} className="border-t border-ink-800/10 dark:border-parchment-50/10">
                      <td className="py-1.5 pr-2 font-medium">{DIMENSION_LABEL[key] ?? key}</td>
                      <td className="py-1.5 pr-2">{String(value.a ?? "—")}</td>
                      <td className="py-1.5">{String(value.b ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-700/50 dark:text-parchment-100/40">{result.note}</p>
          </section>
        </>
      )}
    </div>
  );
}
