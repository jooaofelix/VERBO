import type { AnalysisResult } from "@verbo/shared";

const ASPECT_LABEL: Record<string, string> = {
  primeira_frase: "Primeira frase",
  clareza_do_tema: "Clareza do tema",
  desenvolvimento_dos_versos: "Desenvolvimento dos versos",
  preparacao_pre_refrao: "Preparação do pré-refrão",
  impacto_do_refrao: "Impacto do refrão",
  memorabilidade: "Memorabilidade",
  relacao_titulo_refrao: "Relação entre título e refrão",
  uso_de_repeticao: "Uso de repetição",
  contraste_entre_secoes: "Contraste entre seções",
  funcao_da_ponte: "Função da ponte",
  encerramento: "Encerramento",
  quantidade_de_informacao: "Quantidade de informação",
  cliche: "Clichê",
  imagem_original: "Imagem original",
  campo_semantico: "Campo semântico",
  unidade_poetica: "Unidade poética",
  funcao_de_secao_ausente: "Seção sem função clara",
};

export function CompositionTab({ result }: { result: AnalysisResult }) {
  const { chorusAnalysis, compositionFindings } = result;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Refrão</h3>
        {!chorusAnalysis.present ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhum refrão claro foi identificado na divisão de seções atual.
          </p>
        ) : (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm">
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                ["Resume a mensagem", chorusAnalysis.summarizesMessage],
                ["É memorável", chorusAnalysis.memorable],
                ["Possui frase central", chorusAnalysis.hasCentralPhrase],
                ["O título aparece", chorusAnalysis.titleAppears],
                ["Compreendido isoladamente", chorusAnalysis.standsAlone],
                ["Mais forte que os versos", chorusAnalysis.strongerThanVerses],
                ["Bom para canto coletivo", chorusAnalysis.goodForCollectiveSinging],
              ]
                .filter(([, v]) => v !== undefined)
                .map(([label, v]) => (
                  <li key={label as string} className="flex items-center gap-1.5">
                    <span className={v ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {v ? "✓" : "✕"}
                    </span>
                    {label}
                  </li>
                ))}
            </ul>
            {chorusAnalysis.candidatePhrases.length > 0 && (
              <div className="mt-2 border-t border-emerald-500/20 pt-2">
                <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
                  Frases centrais candidatas
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {chorusAnalysis.candidatePhrases.map((c, i) => (
                    <li key={i}>
                      "{c.text}" <span className="text-xs text-ink-700/50 dark:text-parchment-100/40">({c.function.replaceAll("_", " ")})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {chorusAnalysis.notes && (
              <p className="mt-2 text-ink-700/80 dark:text-parchment-100/70">{chorusAnalysis.notes}</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Estrutura e composição</h3>
        {compositionFindings.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhuma observação de composição destacada.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {compositionFindings.map((f) => (
              <div
                key={f.id}
                className={`rounded-lg border p-3 text-sm ${
                  f.isStrength
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "border-amber-500/25 bg-amber-500/5"
                }`}
              >
                <span className="rounded-full bg-ink-800/10 px-2 py-0.5 text-xs dark:bg-parchment-50/10">
                  {ASPECT_LABEL[f.aspect] ?? f.aspect}
                </span>
                <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">{f.observation}</p>
                {f.suggestion && (
                  <p className="mt-1.5">
                    <span className="font-medium">Sugestão: </span>
                    {f.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
