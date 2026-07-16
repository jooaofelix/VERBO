import type { AIProducedAnalysis, AnalyzeRequest, SongSection } from "@verbo/shared";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * "Revisão rápida" never asks for the full AIProducedAnalysis shape — it's
 * one small call that returns exactly these four things, later mapped onto
 * the schema the rest of the app expects.
 */
export const QuickReviewSchema = z.object({
  resumo: z.string(),
  pontosFortes: z.array(z.string()).min(1).max(5),
  correcoesPrioritarias: z.array(z.string()).min(1).max(5),
  sugestaoFinal: z.string(),
});
export type QuickReview = z.infer<typeof QuickReviewSchema>;

/** Small JSON Schema for Workers AI's native structured-output mode. */
export const QUICK_JSON_SCHEMA = zodToJsonSchema(QuickReviewSchema, {
  target: "openApi3",
  $refStrategy: "none",
});

export const QUICK_SYSTEM_PROMPT =
  "Você é revisor de letras musicais cristãs. Responda SOMENTE com um objeto JSON válido, sem " +
  "texto antes/depois, sem markdown, com exatamente estes campos: resumo (string curta), " +
  'pontosFortes (array com até 3 strings), correcoesPrioritarias (array com até 3 strings), ' +
  "sugestaoFinal (string curta). Seja direto.";

export const QUICK_SYSTEM_PROMPT_RETRY =
  "Revisor de letras musicais. Responda SOMENTE com JSON: resumo, pontosFortes (até 3), " +
  "correcoesPrioritarias (até 3), sugestaoFinal. Seja muito breve.";

function formatSections(sections: SongSection[]): string {
  return sections.map((s) => `[${s.id} | ${s.label}]\n${s.text}`).join("\n\n");
}

export function quickUserPayload(_request: AnalyzeRequest, sections: SongSection[]): string {
  return `<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>

Gere: resumo, até 3 pontos fortes, até 3 correções prioritárias e uma sugestão final. Só o JSON.`;
}

export function quickRetryUserPayload(sections: SongSection[]): string {
  return `<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>
Responda rápido: resumo curto, 3 pontos fortes, 3 correções, 1 sugestão. Só o JSON.`;
}

export function quickReviewToAIProducedAnalysis(q: QuickReview): AIProducedAnalysis {
  return {
    overview: {
      perceivedCentralMessage: q.resumo,
      compositionType: "Revisão rápida",
      mainEmotion: "Não avaliado na revisão rápida",
      emotionalMovement: "Não avaliado na revisão rápida",
      likelyAudience: "Não avaliado na revisão rápida",
      likelyUsageContext: "Não avaliado na revisão rápida",
      strengths: q.pontosFortes,
      attentionPoints: q.correcoesPrioritarias,
      consistencyWithStatedIntent: "nao_foi_possivel_determinar",
      consistencyExplanation:
        "A revisão rápida não avalia consistência com a intenção declarada em detalhe.",
    },
    bibleReferences: [],
    biblicalContext: [],
    theologicalClaims: [],
    coherence: {
      messageAppearsClearly: true,
      lyricalSubjectConsistent: true,
      addresseeConsistent: true,
      intensityTrend: "estatica",
      unansweredQuestions: [],
      narrativeMap: { structureType: "poetica" },
      pointOfView: {
        dominantPerson: "Não avaliado na revisão rápida.",
        whoSpeaks: "Não avaliado na revisão rápida.",
        toWhom: "Não avaliado na revisão rápida.",
        shifts: [],
      },
    },
    grammarFindings: [],
    compositionFindings: [],
    chorusAnalysis: { present: false, candidatePhrases: [] },
    rhymeFindings: [],
    mood: {
      perceivedFunctions: ["reflexiva"],
      lyricalEmotions: ["contemplativa"],
      textualEnergy: "constante",
      movementDescription: "Não avaliado na revisão rápida.",
      probableStyleHypotheses: [],
      confidence: "low",
      disclaimer:
        "Esta classificação considera apenas a letra. Arranjo, melodia, harmonia, interpretação e produção podem alterar completamente a percepção musical.",
    },
    congregational: { applicable: false },
    composerQuestions: [],
    findings: [
      {
        id: "quick-suggestion",
        category: "composition",
        originalExcerpt: "(revisão rápida)",
        title: "Sugestão final",
        explanation: q.sugestaoFinal,
        confidence: "medium",
        severity: "observation",
        requiresUserContext: false,
      },
    ],
    limitations: [
      "Revisão rápida: apenas resumo, pontos fortes, correções prioritárias e sugestão final foram avaliados.",
    ],
    disclaimers: [],
    sectionStatus: {},
  };
}
