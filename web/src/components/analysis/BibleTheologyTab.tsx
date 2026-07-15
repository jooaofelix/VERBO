import type { AnalysisResult, BibleReference, TheologicalClaim } from "@verbo/shared";
import { useState } from "react";
import { ConfidenceBadge } from "../badges.js";

const RELATION_LABEL: Record<BibleReference["relationType"], string> = {
  citacao_direta: "Citação direta",
  citacao_adaptada: "Citação adaptada",
  parafrase: "Paráfrase",
  alusao: "Alusão",
  imagem_biblica: "Imagem bíblica",
  tema_biblico_geral: "Tema bíblico geral",
  afirmacao_doutrinaria: "Afirmação doutrinária",
  sem_referencia: "Sem referência identificável",
};

const USAGE_LABEL: Record<string, string> = {
  coerente_com_contexto: "Coerente com o contexto",
  aplicacao_possivel: "Aplicação possível",
  aplicacao_devocional: "Aplicação devocional",
  relacao_tematica_indireta: "Relação temática indireta",
  interpretacao_discutivel: "Interpretação discutível",
  possivel_uso_fora_de_contexto: "Possível uso fora do contexto",
  referencia_insuficiente: "Referência insuficiente",
};

function ReferenceCard({
  reference,
  context,
}: {
  reference: BibleReference;
  context?: AnalysisResult["biblicalContext"][number];
}) {
  return (
    <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{reference.referenceLabel}</span>
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-400">
          {RELATION_LABEL[reference.relationType]}
        </span>
        <ConfidenceBadge level={reference.confidence} />
      </div>
      <blockquote className="mt-1.5 border-l-2 border-blue-500/30 pl-2 italic text-ink-700/80 dark:text-parchment-100/70">
        "{reference.excerptFromLyrics}"
      </blockquote>
      <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">{reference.explanation}</p>

      {reference.verseTextAvailable && reference.verseText ? (
        <div className="mt-2 rounded border border-blue-500/20 bg-white/50 p-2 dark:bg-ink-900/40">
          <p className="italic">"{reference.verseText}"</p>
          <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
            {reference.attribution}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-700/50 dark:text-parchment-100/40">
          Texto do versículo não disponível no conjunto de demonstração — confirme em uma Bíblia
          oficial.
        </p>
      )}

      {context && (
        <div className="mt-2 border-t border-blue-500/20 pt-2 text-xs text-ink-700/70 dark:text-parchment-100/60">
          <p>
            <span className="font-medium">Classificação de uso: </span>
            {USAGE_LABEL[context.usageClassification] ?? context.usageClassification}
          </p>
          <p className="mt-1">
            <span className="font-medium">Contexto histórico/literário: </span>
            {context.historicalContext}
          </p>
          <p className="mt-1">
            <span className="font-medium">Intenção da passagem: </span>
            {context.passageIntent}
          </p>
          <p className="mt-1">
            <span className="font-medium">Relação com a letra: </span>
            {context.relationToLyrics}
          </p>
          {context.contextRisk && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              <span className="font-medium">Risco de descontextualização: </span>
              {context.contextRisk}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TheologicalClaimCard({ claim }: { claim: TheologicalClaim }) {
  const [showAlternates, setShowAlternates] = useState(false);
  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-400">
          {claim.classification.replaceAll("_", " ")}
        </span>
        <ConfidenceBadge level={claim.confidence} />
        {claim.dependsOnTradition && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
            Depende de tradição
          </span>
        )}
      </div>
      <blockquote className="mt-1.5 border-l-2 border-violet-500/30 pl-2 italic text-ink-700/80 dark:text-parchment-100/70">
        "{claim.excerptFromLyrics}"
      </blockquote>
      <p className="mt-1.5 text-ink-700/80 dark:text-parchment-100/70">{claim.whatItSeemsToAffirm}</p>
      {claim.traditionNotes && (
        <p className="mt-1.5 text-xs text-ink-700/60 dark:text-parchment-100/50">
          {claim.traditionNotes}
        </p>
      )}
      {claim.alternateInterpretations.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAlternates((v) => !v)}
            className="text-xs font-medium text-violet-700 underline dark:text-violet-400"
          >
            {showAlternates ? "Ocultar" : "Ver"} outras leituras teológicas
          </button>
          {showAlternates && (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {claim.alternateInterpretations.map((alt, i) => (
                <li key={i} className="text-xs text-ink-700/70 dark:text-parchment-100/60">
                  <span className="font-medium">{alt.associatedTraditions.join(", ")}: </span>
                  {alt.interpretation}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function BibleTheologyTab({ result }: { result: AnalysisResult }) {
  const contextByRef = new Map(result.biblicalContext.map((c) => [c.referenceId, c]));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Referências bíblicas identificadas</h3>
        {result.bibleReferences.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Não encontrei uma referência bíblica suficientemente direta para afirmar que algum
            trecho deriva de um versículo específico.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {result.bibleReferences.map((ref) => (
              <ReferenceCard key={ref.id} reference={ref} context={contextByRef.get(ref.id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Afirmações teológicas</h3>
        {result.theologicalClaims.length === 0 ? (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhuma afirmação teológica específica foi destacada.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {result.theologicalClaims.map((claim) => (
              <TheologicalClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
