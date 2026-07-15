import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { diffWords } from "../lib/diff.js";
import { useAuth } from "../hooks/useAuth.js";
import { useSong } from "../hooks/useSong.js";
import { useSongVersions } from "../hooks/useSongVersions.js";
import { getAnalysis } from "../repositories/analysesRepository.js";
import type { AnalysisDoc } from "../types/firestore.js";

const CONSISTENCY_LABEL: Record<string, string> = {
  muito_consistente: "Muito consistente",
  consistente: "Consistente",
  parcialmente_consistente: "Parcialmente consistente",
  precisa_revisao: "Precisa de revisão",
  nao_foi_possivel_determinar: "Não foi possível determinar",
};

export function CompareVersions() {
  const { songId } = useParams();
  const { user } = useAuth();
  const { song } = useSong(songId);
  const { versions } = useSongVersions(songId);

  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  const [analysisA, setAnalysisA] = useState<AnalysisDoc | null>(null);
  const [analysisB, setAnalysisB] = useState<AnalysisDoc | null>(null);

  useEffect(() => {
    if (versions.length >= 2 && !aId && !bId) {
      setAId(versions[versions.length - 2].id);
      setBId(versions[versions.length - 1].id);
    }
  }, [versions, aId, bId]);

  const versionA = versions.find((v) => v.id === aId);
  const versionB = versions.find((v) => v.id === bId);

  useEffect(() => {
    if (!user || !songId || !versionA?.currentAnalysisId) {
      setAnalysisA(null);
      return;
    }
    getAnalysis(user.uid, songId, versionA.currentAnalysisId).then((a) => setAnalysisA(a));
  }, [user, songId, versionA?.currentAnalysisId]);

  useEffect(() => {
    if (!user || !songId || !versionB?.currentAnalysisId) {
      setAnalysisB(null);
      return;
    }
    getAnalysis(user.uid, songId, versionB.currentAnalysisId).then((b) => setAnalysisB(b));
  }, [user, songId, versionB?.currentAnalysisId]);

  const tokens = useMemo(
    () => (versionA && versionB ? diffWords(versionA.lyrics, versionB.lyrics) : []),
    [versionA, versionB]
  );

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

      {versionA && versionB && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">O que mudou no texto</h2>
            <div className="rounded-xl border border-ink-800/10 bg-white/60 p-4 text-sm leading-relaxed dark:border-parchment-50/10 dark:bg-ink-900/50">
              <p className="whitespace-pre-wrap">
                {tokens.map((t, i) => (
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
                  <Row
                    label="Consistência com a intenção"
                    a={analysisA ? CONSISTENCY_LABEL[analysisA.result.overview.consistencyWithStatedIntent] : "sem análise"}
                    b={analysisB ? CONSISTENCY_LABEL[analysisB.result.overview.consistencyWithStatedIntent] : "sem análise"}
                  />
                  <Row
                    label="Achados de português"
                    a={analysisA ? String(analysisA.result.grammarFindings.length) : "—"}
                    b={analysisB ? String(analysisB.result.grammarFindings.length) : "—"}
                  />
                  <Row
                    label="Referências bíblicas identificadas"
                    a={analysisA ? String(analysisA.result.bibleReferences.length) : "—"}
                    b={analysisB ? String(analysisB.result.bibleReferences.length) : "—"}
                  />
                  <Row
                    label="Pontos de atenção"
                    a={analysisA ? String(analysisA.result.overview.attentionPoints.length) : "—"}
                    b={analysisB ? String(analysisB.result.overview.attentionPoints.length) : "—"}
                  />
                  <Row
                    label="Palavras na letra"
                    a={String(versionA.lyrics.split(/\s+/).filter(Boolean).length)}
                    b={String(versionB.lyrics.split(/\s+/).filter(Boolean).length)}
                  />
                  <Row label="Aprovada" a={versionA.approved ? "Sim" : "Não"} b={versionB.approved ? "Sim" : "Não"} />
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-t border-ink-800/10 dark:border-parchment-50/10">
      <td className="py-1.5 pr-2 font-medium">{label}</td>
      <td className="py-1.5 pr-2">{a}</td>
      <td className="py-1.5">{b}</td>
    </tr>
  );
}
