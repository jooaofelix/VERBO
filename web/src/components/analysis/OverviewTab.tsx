import type { AnalysisResult } from "@verbo/shared";

const CONSISTENCY_LABEL: Record<AnalysisResult["overview"]["consistencyWithStatedIntent"], string> = {
  muito_consistente: "Muito consistente",
  consistente: "Consistente",
  parcialmente_consistente: "Parcialmente consistente",
  precisa_revisao: "Precisa de revisão",
  nao_foi_possivel_determinar: "Não foi possível determinar",
};

const CONSISTENCY_CLASS: Record<AnalysisResult["overview"]["consistencyWithStatedIntent"], string> = {
  muito_consistente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  consistente: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  parcialmente_consistente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  precisa_revisao: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  nao_foi_possivel_determinar: "bg-ink-800/10 text-ink-700 dark:bg-parchment-50/10 dark:text-parchment-100/70",
};

export function OverviewTab({ result }: { result: AnalysisResult }) {
  const { overview, mood } = result;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          CONSISTENCY_CLASS[overview.consistencyWithStatedIntent]
        }`}
      >
        {CONSISTENCY_LABEL[overview.consistencyWithStatedIntent]}
      </div>
      <p className="text-sm text-ink-700/80 dark:text-parchment-100/70">
        {overview.consistencyExplanation}
      </p>

      <p className="text-base leading-relaxed">{overview.perceivedCentralMessage}</p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
            Tipo de composição
          </dt>
          <dd className="text-sm">{overview.compositionType}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
            Emoção principal
          </dt>
          <dd className="text-sm">{overview.mainEmotion}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
            Movimento emocional
          </dt>
          <dd className="text-sm">{overview.emotionalMovement}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
            Público / contexto prováveis
          </dt>
          <dd className="text-sm">
            {overview.likelyAudience} — {overview.likelyUsageContext}
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Pontos fortes</h3>
          <ul className="list-disc pl-5 text-sm text-ink-700/80 dark:text-parchment-100/70">
            {overview.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Pontos que merecem atenção</h3>
          {overview.attentionPoints.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">Nenhum apontado.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm text-ink-700/80 dark:text-parchment-100/70">
              {overview.attentionPoints.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-ink-800/10 p-3 text-sm dark:border-parchment-50/10">
        <p className="font-medium">Classificação (baseada apenas na letra)</p>
        <p className="mt-1 text-ink-700/80 dark:text-parchment-100/70">
          Funções: {mood.perceivedFunctions.join(", ")} · Emoções: {mood.lyricalEmotions.join(", ")} ·
          Energia textual: {mood.textualEnergy}
        </p>
        {mood.probableStyleHypotheses.length > 0 && (
          <p className="mt-1 text-ink-700/80 dark:text-parchment-100/70">
            Hipóteses de estilo: {mood.probableStyleHypotheses.join(", ")}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-700/50 dark:text-parchment-100/40">{mood.disclaimer}</p>
      </div>
    </div>
  );
}
