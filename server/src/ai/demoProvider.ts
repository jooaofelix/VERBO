import type { AIProducedAnalysis } from "@verbo/shared";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";

const DEMO_DISCLAIMER =
  "MODO DEMONSTRAÇÃO: nenhuma chave de API de IA foi configurada no servidor (ANTHROPIC_API_KEY). " +
  "Esta análise é um exemplo estático de como o resultado se organiza — não foi gerada a partir " +
  "da letra real enviada. Configure a variável de ambiente para obter uma análise de verdade.";

/**
 * Produces a schema-valid, clearly-labeled example analysis so the whole app
 * (UI, export, comparisons) can be exercised end-to-end without an API key.
 * Every section repeats the demo disclaimer so nobody mistakes this for a
 * real read of their lyrics.
 */
export class DemoAIProvider implements AIAnalysisProvider {
  readonly mode = "demo" as const;

  async analyzeLyrics(input: LyricsAnalysisInput): Promise<AIProducedAnalysis> {
    const firstSectionId = input.sections[0]?.id ?? "sec-1";
    const chorus = input.sections.find((s) => s.type === "refrao");
    const lineCount = input.sections.reduce((n, s) => n + s.text.split("\n").length, 0);

    const result: AIProducedAnalysis = {
      overview: {
        perceivedCentralMessage:
          "[Exemplo de demonstração] A letra parece expressar confiança em Deus em meio a uma " +
          "situação difícil, caminhando de um cenário de tensão para uma declaração de descanso.",
        compositionType: "Declaração de fé com tom devocional (exemplo)",
        mainEmotion: "Esperança",
        emotionalMovement: "De inquietação inicial para confiança crescente",
        likelyAudience: input.request.context.intendedAudience || "Público geral cristão (estimativa de exemplo)",
        likelyUsageContext:
          input.request.context.usageContext ?? "Não informado pelo compositor — exemplo genérico",
        strengths: [
          "[Exemplo] O refrão comunica uma ideia central de forma direta.",
          "[Exemplo] A progressão emocional entre as seções é perceptível.",
        ],
        attentionPoints: [
          "[Exemplo] Configure ANTHROPIC_API_KEY para receber pontos de atenção reais desta letra.",
        ],
        consistencyWithStatedIntent: "nao_foi_possivel_determinar",
        consistencyExplanation:
          "Não é possível avaliar consistência real em modo demonstração — esta é uma resposta de exemplo fixa.",
      },
      bibleReferences: [],
      biblicalContext: [],
      theologicalClaims: [],
      coherence: {
        messageAppearsClearly: true,
        lyricalSubjectConsistent: true,
        addresseeConsistent: true,
        intensityTrend: "crescente",
        unansweredQuestions: [],
        narrativeMap: {
          startingPoint: "[Exemplo] Situação de tensão ou dúvida.",
          conflictOrTension: "[Exemplo] Incerteza diante de uma dificuldade.",
          development: "[Exemplo] Lembrança de promessas ou experiências passadas.",
          revelation: undefined,
          response: "[Exemplo] Decisão de confiar.",
          conclusion: "[Exemplo] Declaração de descanso/confiança.",
          structureType: "declarativa",
        },
        pointOfView: {
          dominantPerson: "Primeira pessoa do singular",
          whoSpeaks: "O eu lírico / compositor",
          toWhom: "Deus (oração) — estimativa de exemplo",
          aboutWhom: undefined,
          shifts: [],
        },
      },
      grammarFindings: [],
      compositionFindings: [
        {
          id: "demo-comp-1",
          aspect: "impacto_do_refrao",
          sectionId: chorus?.id ?? firstSectionId,
          observation:
            "[Exemplo] Em uma análise real, este campo comentaria se o refrão resume bem a mensagem central.",
          isStrength: true,
        },
      ],
      chorusAnalysis: {
        present: Boolean(chorus),
        summarizesMessage: Boolean(chorus),
        memorable: Boolean(chorus),
        candidatePhrases: chorus
          ? [
              {
                text: chorus.text.split("\n")[0]?.trim() || "(primeira linha do refrão)",
                function: "centro_emocional",
              },
            ]
          : [],
        notes: chorus
          ? "[Exemplo] Refrão identificado pela repetição textual."
          : "[Exemplo] Nenhum refrão claro foi identificado na divisão de seções atual.",
      },
      rhymeFindings: [],
      mood: {
        perceivedFunctions: ["devocional"],
        lyricalEmotions: ["esperancosa", "confessional"],
        textualEnergy: "crescente",
        movementDescription: "[Exemplo] Energia textual crescente ao longo da letra.",
        probableStyleHypotheses: ["Worship contemporâneo (hipótese de exemplo)"],
        confidence: "low",
        disclaimer:
          "Esta classificação considera apenas a letra. Arranjo, melodia, harmonia, interpretação e produção podem alterar completamente a percepção musical.",
      },
      congregational: {
        applicable: input.request.context.usageContext === "congregacional",
        clarity: "[Exemplo] Comentário sobre clareza para canto coletivo apareceria aqui.",
        notes: "Resultado de exemplo — não reflete a letra enviada.",
      },
      composerQuestions: [
        {
          id: "demo-q-1",
          question:
            "[Exemplo de pergunta] Esta é uma amostra de como o sistema formula perguntas ao compositor quando algo não pode ser concluído com segurança.",
        },
      ],
      findings: [
        {
          id: "demo-finding-1",
          category: "composition",
          sectionId: firstSectionId,
          originalExcerpt: input.sections[0]?.text.split("\n")[0]?.trim() ?? "(primeira linha)",
          title: "[Exemplo] Ponto forte de abertura",
          explanation:
            "Em modo demonstração, este cartão mostraria uma observação real sobre a primeira linha da letra.",
          confidence: "low",
          severity: "observation",
          requiresUserContext: false,
        },
      ],
      limitations: [
        `Esta resposta é um exemplo estático (modo demonstração), não uma leitura real das ${lineCount} linhas enviadas.`,
      ],
      disclaimers: [DEMO_DISCLAIMER],
    };

    return result;
  }
}
