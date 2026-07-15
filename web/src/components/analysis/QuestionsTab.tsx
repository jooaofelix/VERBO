import type { AnalysisResult } from "@verbo/shared";

export function QuestionsTab({ result }: { result: AnalysisResult }) {
  if (result.composerQuestions.length === 0) {
    return (
      <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
        Nenhuma pergunta pendente — a análise não encontrou pontos que exigissem esclarecimento
        direto do compositor desta vez.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
        Quando o sistema não tem segurança suficiente para concluir algo sozinho, ele pergunta em
        vez de inventar uma resposta.
      </p>
      {result.composerQuestions.map((q) => (
        <div key={q.id} className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-sm">
          <p>{q.question}</p>
          {q.relatedExcerpt && (
            <blockquote className="mt-1.5 border-l-2 border-sky-500/30 pl-2 italic text-ink-700/70 dark:text-parchment-100/60">
              "{q.relatedExcerpt}"
            </blockquote>
          )}
        </div>
      ))}
    </div>
  );
}
