import type { AnalysisResult } from "@verbo/shared";
import { FindingCard } from "../FindingCard.js";

const SEVERITY_PRIORITY: Record<string, number> = {
  probable_error: 0,
  attention: 1,
  theological_discussion: 2,
  observation: 3,
  strength: 4,
};

interface Props {
  result: AnalysisResult;
  decisions: Record<string, "accepted" | "ignored">;
  onDecide: (findingId: string, decision: "accepted" | "ignored" | undefined) => void;
}

export function SuggestionsTab({ result, decisions, onDecide }: Props) {
  const withSuggestions = result.findings
    .filter((f) => f.suggestion)
    .sort((a, b) => (SEVERITY_PRIORITY[a.severity] ?? 9) - (SEVERITY_PRIORITY[b.severity] ?? 9));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
        Sugestões são opcionais e nunca substituem sua voz autoral. Aceite ou ignore cada uma —
        nada aqui altera a letra original automaticamente.
      </p>
      {withSuggestions.length === 0 ? (
        <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
          Nenhuma sugestão específica neste momento.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {withSuggestions.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              decision={decisions[f.id]}
              onDecide={(decision) => onDecide(f.id, decision)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
