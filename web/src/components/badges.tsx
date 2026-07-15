import type { ConfidenceLevel, FindingSeverity, HighlightCategory } from "@verbo/shared";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: "Confiança baixa",
  medium: "Confiança média",
  high: "Confiança alta",
};

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  low: "bg-ink-800/10 text-ink-700 dark:bg-parchment-50/10 dark:text-parchment-100/70",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[level]}`}>
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  strength: "Ponto forte",
  observation: "Observação",
  attention: "Atenção",
  probable_error: "Erro provável",
  theological_discussion: "Discussão teológica",
};

const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  strength: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  observation: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  attention: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  probable_error: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  theological_discussion: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export const CATEGORY_LABEL: Record<HighlightCategory, string> = {
  biblical: "Referência bíblica",
  theological: "Teologia",
  grammar: "Português",
  composition: "Composição",
  artistic_choice: "Escolha artística",
  congregational: "Congregacional",
};

export const CATEGORY_DOT_CLASS: Record<HighlightCategory, string> = {
  biblical: "bg-blue-500",
  theological: "bg-violet-500",
  grammar: "bg-rose-500",
  composition: "bg-emerald-500",
  artistic_choice: "bg-slate-400",
  congregational: "bg-amber-500",
};

export const CATEGORY_MARK_CLASS: Record<HighlightCategory, string> = {
  biblical: "bg-blue-500/20 decoration-blue-500",
  theological: "bg-violet-500/20 decoration-violet-500",
  grammar: "bg-rose-500/20 decoration-rose-500",
  composition: "bg-emerald-500/20 decoration-emerald-500",
  artistic_choice: "bg-slate-400/20 decoration-slate-400",
  congregational: "bg-amber-500/20 decoration-amber-500",
};
