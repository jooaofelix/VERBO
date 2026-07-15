import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { diffWords } from "../lib/diff.js";
import { useSongsStore } from "../state/store.js";

const CONSISTENCY_LABEL: Record<string, string> = {
  muito_consistente: "Muito consistente",
  consistente: "Consistente",
  parcialmente_consistente: "Parcialmente consistente",
  precisa_revisao: "Precisa de revisão",
  nao_foi_possivel_determinar: "Não foi possível determinar",
};

export function CompareVersions() {
  const { songId } = useParams();
  const song = useSongsStore((s) => (songId ? s.songs[songId] : undefined));

  const versionIds = song?.versionOrder ?? [];
  const [aId, setAId] = useState(versionIds[versionIds.length - 2] ?? versionIds[0]);
  const [bId, setBId] = useState(versionIds[versionIds.length - 1]);

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

  const a = song.versions[aId];
  const b = song.versions[bId];
  const tokens = a && b ? diffWords(a.lyrics, b.lyrics) : [];

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
            {versionIds.map((id) => (
              <option key={id} value={id}>
                {song.versions[id].versionName}
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
            {versionIds.map((id) => (
              <option key={id} value={id}>
                {song.versions[id].versionName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {a && b && (
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
                    <th className="py-1 pr-2">{a.versionName}</th>
                    <th className="py-1">{b.versionName}</th>
                  </tr>
                </thead>
                <tbody>
                  <Row
                    label="Consistência com a intenção"
                    a={a.analysis ? CONSISTENCY_LABEL[a.analysis.overview.consistencyWithStatedIntent] : "sem análise"}
                    b={b.analysis ? CONSISTENCY_LABEL[b.analysis.overview.consistencyWithStatedIntent] : "sem análise"}
                  />
                  <Row
                    label="Achados de português"
                    a={a.analysis ? String(a.analysis.grammarFindings.length) : "—"}
                    b={b.analysis ? String(b.analysis.grammarFindings.length) : "—"}
                  />
                  <Row
                    label="Referências bíblicas identificadas"
                    a={a.analysis ? String(a.analysis.bibleReferences.length) : "—"}
                    b={b.analysis ? String(b.analysis.bibleReferences.length) : "—"}
                  />
                  <Row
                    label="Pontos de atenção"
                    a={a.analysis ? String(a.analysis.overview.attentionPoints.length) : "—"}
                    b={b.analysis ? String(b.analysis.overview.attentionPoints.length) : "—"}
                  />
                  <Row label="Palavras na letra" a={String(a.lyrics.split(/\s+/).filter(Boolean).length)} b={String(b.lyrics.split(/\s+/).filter(Boolean).length)} />
                  <Row label="Aprovada" a={a.approved ? "Sim" : "Não"} b={b.approved ? "Sim" : "Não"} />
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
