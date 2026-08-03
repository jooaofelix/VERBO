import type { AIProducedAnalysis } from "@verbo/shared";
import type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";

const DEMO_DISCLAIMER =
  "MODO DEMONSTRAÇÃO: o binding de Workers AI não está disponível neste ambiente. " +
  "Esta análise é um exemplo estático de como o resultado se organiza — não foi gerada a partir " +
  "da letra real enviada. Rode via `wrangler dev`/`wrangler deploy` com o binding \"AI\" configurado " +
  "para obter uma análise de verdade.";

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
    const lineCount = input.sections.reduce((n, s) => n + s.text.split("\n").length, 0);

    const result: AIProducedAnalysis = {
      overview: {
        perceivedCentralMessage:
          "[Exemplo de demonstração] A letra parece expressar confiança em Deus em meio a uma " +
          "situação difícil, caminhando de um cenário de tensão para uma declaração de descanso.",
        likelyAudience: input.request.context.intendedAudience || "Público geral cristão (estimativa de exemplo)",
        strengths: [
          "[Exemplo] O refrão comunica uma ideia central de forma direta.",
          "[Exemplo] A progressão emocional entre as seções é perceptível.",
        ],
        attentionPoints: [
          "[Exemplo] Rode com o binding de Workers AI disponível para receber pontos de atenção reais desta letra.",
        ],
        consistencyWithStatedIntent: "nao_foi_possivel_determinar",
        consistencyExplanation:
          "Não é possível avaliar consistência real em modo demonstração — esta é uma resposta de exemplo fixa.",
      },
      bibleReferences: [],
      biblicalContext: [],
      theologicalClaims: [],
      grammarFindings: [],
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
          category: "theological",
          sectionId: firstSectionId,
          originalExcerpt: input.sections[0]?.text.split("\n")[0]?.trim() ?? "(primeira linha)",
          title: "[Exemplo] Observação teológica de abertura",
          explanation:
            "Em modo demonstração, este cartão mostraria uma observação teológica real sobre a primeira linha da letra.",
          confidence: "low",
          severity: "observation",
          requiresUserContext: false,
        },
      ],
      limitations: [
        `Esta resposta é um exemplo estático (modo demonstração), não uma leitura real das ${lineCount} linhas enviadas.`,
      ],
      disclaimers: [DEMO_DISCLAIMER],
      sectionStatus: {},
      topPriorities: [
        "[Exemplo] Em uma análise real, as correções mais importantes apareceriam aqui, em ordem.",
      ],
      narrativeConsistencyIssues: [],
      portugueseSummary:
        "[Exemplo] Um resumo da revisão de português apareceria aqui em uma análise real.",
    };

    return result;
  }
}
