import type { AnalysisResult } from "@verbo/shared";

const FIELD_LABELS: Array<[keyof AnalysisResult["congregational"], string]> = [
  ["clarity", "Clareza da mensagem"],
  ["godCenteredness", "Centralidade em Deus"],
  ["comprehensionWithoutExplanation", "Compreensão sem explicação adicional"],
  ["memorization", "Facilidade de memorização"],
  ["repetitionNote", "Uso de repetição"],
  ["lineLength", "Comprimento das frases"],
  ["vocabulary", "Vocabulário"],
  ["theologicalTermsUsage", "Uso de termos teológicos"],
  ["individualVsCollectivePerspective", "Perspectiva individual/coletiva"],
  ["singability", "Facilidade de canto"],
  ["wordsPerLine", "Palavras por linha"],
  ["vocalInterpretationDependency", "Dependência de interpretação vocal"],
  ["ambiguityWhenSungByCommunity", "Ambiguidades ao ser cantada pela comunidade"],
  ["personalVsSharedTruthBalance", "Equilíbrio entre experiência pessoal e verdade compartilhada"],
  ["simplicityVsDensityNote", "Simplicidade vs. densidade teológica"],
];

export function CongregationalTab({ result }: { result: AnalysisResult }) {
  const c = result.congregational;

  if (!c.applicable) {
    return (
      <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
        Esta letra não foi marcada como destinada ao uso congregacional. Marque o contexto de uso
        como "Música congregacional" ao criar a análise para receber esta leitura.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {FIELD_LABELS.filter(([key]) => c[key]).map(([key, label]) => (
        <div key={key} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
            {label}
          </p>
          <p className="mt-0.5 text-ink-700/80 dark:text-parchment-100/70">{c[key] as string}</p>
        </div>
      ))}
      {c.needsComposerBackstory && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Esta letra parece depender de conhecer a história do compositor para ser plenamente
          compreendida por quem a canta em comunidade.
        </p>
      )}
      {c.notes && <p className="text-sm text-ink-700/80 dark:text-parchment-100/70">{c.notes}</p>}
    </div>
  );
}
