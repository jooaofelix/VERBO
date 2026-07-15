import type { AnalysisFinding } from "@verbo/shared";
import { CATEGORY_LABEL } from "./badges.js";
import { ConfidenceBadge, SeverityBadge } from "./badges.js";

interface Props {
  finding: AnalysisFinding;
  decision?: "accepted" | "ignored";
  onDecide?: (decision: "accepted" | "ignored" | undefined) => void;
}

export function FindingCard({ finding, decision, onDecide }: Props) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm transition ${
        decision === "ignored"
          ? "border-ink-800/10 opacity-50 dark:border-parchment-50/10"
          : decision === "accepted"
            ? "border-emerald-500/40"
            : "border-ink-800/10 dark:border-parchment-50/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-ink-800/10 px-2 py-0.5 text-xs dark:bg-parchment-50/10">
          {CATEGORY_LABEL[finding.category]}
        </span>
        <SeverityBadge severity={finding.severity} />
        <ConfidenceBadge level={finding.confidence} />
      </div>

      <p className="mt-2 font-medium">{finding.title}</p>
      <blockquote className="mt-1 border-l-2 border-ink-800/20 pl-2 italic text-ink-700/80 dark:border-parchment-50/20 dark:text-parchment-100/70">
        "{finding.originalExcerpt}"
      </blockquote>
      <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">{finding.explanation}</p>

      {finding.suggestion && (
        <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">
          <span className="font-medium">Sugestão: </span>
          {finding.suggestion}
        </p>
      )}

      {finding.evidence && finding.evidence.length > 0 && (
        <ul className="mt-1.5 list-disc pl-5 text-xs text-ink-700/60 dark:text-parchment-100/50">
          {finding.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {finding.requiresUserContext && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
          O sistema não tem segurança suficiente aqui — só você, compositor, pode confirmar.
        </p>
      )}

      {onDecide && (
        <div className="mt-2 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => onDecide(decision === "accepted" ? undefined : "accepted")}
            className={`rounded-full border px-2.5 py-1 ${
              decision === "accepted"
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                : "border-ink-800/15 dark:border-parchment-50/15"
            }`}
          >
            ✓ Aceitar
          </button>
          <button
            type="button"
            onClick={() => onDecide(decision === "ignored" ? undefined : "ignored")}
            className={`rounded-full border px-2.5 py-1 ${
              decision === "ignored"
                ? "border-ink-800/40 dark:border-parchment-50/40"
                : "border-ink-800/15 dark:border-parchment-50/15"
            }`}
          >
            ✕ Ignorar
          </button>
        </div>
      )}
    </div>
  );
}
