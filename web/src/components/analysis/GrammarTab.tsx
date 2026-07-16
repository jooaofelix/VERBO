import type { AnalysisResult, GrammarFinding } from "@verbo/shared";

const TYPE_LABEL: Record<GrammarFinding["type"], string> = {
  ortografia: "Ortografia",
  acentuacao: "Acentuação",
  pontuacao: "Pontuação",
  concordancia_verbal: "Concordância verbal",
  concordancia_nominal: "Concordância nominal",
  regencia: "Regência",
  colocacao_pronominal: "Colocação pronominal",
  conjugacao_verbal: "Conjugação verbal",
  consistencia_tempos_verbais: "Consistência de tempos verbais",
  ambiguidade: "Ambiguidade",
  repeticao_involuntaria: "Repetição involuntária",
  pleonasmo: "Pleonasmo",
  cacofonia: "Cacofonia",
  construcao_pouco_natural: "Construção pouco natural",
  palavra_dificil_de_cantar: "Palavra difícil de cantar",
  frase_longa: "Frase longa",
};

const CLASSIFICATION_LABEL: Record<GrammarFinding["classification"], string> = {
  erro_provavel: "Erro provável",
  liberdade_poetica_funcional: "Liberdade poética funcional",
  liberdade_poetica_confusa: "Liberdade poética que pode confundir",
  escolha_estilistica: "Escolha estilística",
  nao_determinado_sem_melodia: "Não determinado sem melodia",
};

const CLASSIFICATION_CLASS: Record<GrammarFinding["classification"], string> = {
  erro_provavel: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  liberdade_poetica_funcional: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  liberdade_poetica_confusa: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  escolha_estilistica: "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  nao_determinado_sem_melodia: "bg-ink-800/10 text-ink-700 dark:bg-parchment-50/10 dark:text-parchment-100/70",
};

const SEVERITY_LABEL: Record<"baixa" | "media" | "alta", string> = {
  baixa: "Gravidade baixa",
  media: "Gravidade média",
  alta: "Gravidade alta",
};

const SEVERITY_CLASS: Record<"baixa" | "media" | "alta", string> = {
  baixa: "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  alta: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

function GrammarFindingRow({ finding }: { finding: GrammarFinding }) {
  return (
    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-400">
          {TYPE_LABEL[finding.type]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${CLASSIFICATION_CLASS[finding.classification]}`}>
          {CLASSIFICATION_LABEL[finding.classification]}
        </span>
        {finding.severity && (
          <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_CLASS[finding.severity]}`}>
            {SEVERITY_LABEL[finding.severity]}
          </span>
        )}
        {finding.source === "deterministico" && (
          <span className="rounded-full bg-ink-800/10 px-2 py-0.5 text-xs dark:bg-parchment-50/10">
            checagem automática
          </span>
        )}
      </div>
      <blockquote className="mt-1.5 border-l-2 border-rose-500/30 pl-2 italic">
        "{finding.originalExcerpt}"
      </blockquote>
      <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">{finding.explanation}</p>
      {finding.possibleCorrection && (
        <p className="mt-1.5">
          <span className="font-medium">Opção 1: </span>
          {finding.possibleCorrection}
        </p>
      )}
      {finding.alternativeCorrection && (
        <p className="mt-1">
          <span className="font-medium">Opção 2: </span>
          {finding.alternativeCorrection}
        </p>
      )}
      {finding.meaningChangeNote && (
        <p className="mt-1.5 text-xs text-ink-700/60 dark:text-parchment-100/50">
          {finding.meaningChangeNote}
        </p>
      )}
      {finding.metricImpact && (
        <p className="mt-1 text-xs text-ink-700/60 dark:text-parchment-100/50">
          Impacto na métrica: {finding.metricImpact}
        </p>
      )}
    </div>
  );
}

export function GrammarTab({ result }: { result: AnalysisResult }) {
  const longLines = result.prosodyFindings.filter((p) => p.lineLengthClass === "longa");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Português</h3>
        {result.grammarFindings.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhuma ocorrência linguística relevante identificada.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {result.grammarFindings.map((f) => (
              <GrammarFindingRow key={f.id} finding={f} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Prosódia (estimativa textual, sem melodia)</h3>
        <p className="mb-2 text-xs text-ink-700/50 dark:text-parchment-100/40">
          Sílabas contadas por aproximação de grupos vocálicos com elisão entre palavras. Sem
          áudio, esta é sempre uma estimativa.
        </p>
        {longLines.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhuma linha muito longa identificada.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {longLines.map((p) => (
              <li key={p.id} className="rounded border border-ink-800/10 p-2 dark:border-parchment-50/10">
                <span className="font-mono text-xs text-ink-700/60 dark:text-parchment-100/50">
                  ≈{p.approxSyllableCount} sílabas
                </span>{" "}
                "{p.lineText}"
                <p className="mt-1 text-xs text-ink-700/60 dark:text-parchment-100/50">{p.fluencyNote}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Rimas e sonoridade</h3>
        {result.rhymeFindings.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhuma observação de rima destacada. A ausência de rimas não é, por si só, um problema.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {result.rhymeFindings.map((r) => (
              <li key={r.id} className="rounded border border-ink-800/10 p-2 dark:border-parchment-50/10">
                <span className="font-medium">{r.type.replaceAll("_", " ")}: </span>
                {r.lines.join(" / ")}
                <p className="mt-1 text-xs text-ink-700/60 dark:text-parchment-100/50">{r.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
