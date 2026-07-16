import {
  AnalysisFindingSchema,
  BibleReferenceSchema,
  BiblicalContextAnalysisSchema,
  ChorusAnalysisSchema,
  CoherenceAnalysisSchema,
  CompositionFindingSchema,
  CongregationalAnalysisSchema,
  GrammarFindingSchema,
  MoodAnalysisSchema,
  OverviewSummarySchema,
  RhymeFindingSchema,
  TheologicalClaimSchema,
  type AnalyzeRequest,
  type RevisionMode,
  type SongSection,
} from "@verbo/shared";
import { z } from "zod";

/**
 * The four independent slices a "revisão completa" is broken into. Each one
 * maps 1:1 to a RevisionMode value, which is what an "individual mode"
 * request (revisionMode !== "rapida"/"completa") already names.
 */
export type Area = "biblica_teologica" | "portugues" | "composicao" | "congregacional";

export const ALL_AREAS: Area[] = ["biblica_teologica", "portugues", "composicao", "congregacional"];

export const AREA_LABELS: Record<Area, string> = {
  biblica_teologica: "bíblica e teológica",
  portugues: "português",
  composicao: "composição",
  congregacional: "congregacional",
};

/** Which areas a given revision mode needs. "rapida" is handled separately (see quickReview.ts). */
export function areasForMode(mode: RevisionMode): Area[] {
  if (mode === "completa") return ALL_AREAS;
  if (mode === "rapida") return [];
  return [mode];
}

// ---- per-area output schemas — each one is a small slice of AIProducedAnalysisSchema ----

export const BiblicalAreaSchema = z.object({
  bibleReferences: z.array(BibleReferenceSchema).default([]),
  biblicalContext: z.array(BiblicalContextAnalysisSchema).default([]),
  theologicalClaims: z.array(TheologicalClaimSchema).default([]),
  findings: z.array(AnalysisFindingSchema).default([]),
});
export type BiblicalAreaOutput = z.infer<typeof BiblicalAreaSchema>;

export const PortuguesAreaSchema = z.object({
  grammarFindings: z.array(GrammarFindingSchema).default([]),
  findings: z.array(AnalysisFindingSchema).default([]),
});
export type PortuguesAreaOutput = z.infer<typeof PortuguesAreaSchema>;

export const ComposicaoAreaSchema = z.object({
  overview: OverviewSummarySchema,
  coherence: CoherenceAnalysisSchema,
  compositionFindings: z.array(CompositionFindingSchema).default([]),
  chorusAnalysis: ChorusAnalysisSchema,
  rhymeFindings: z.array(RhymeFindingSchema).default([]),
  mood: MoodAnalysisSchema,
  findings: z.array(AnalysisFindingSchema).default([]),
});
export type ComposicaoAreaOutput = z.infer<typeof ComposicaoAreaSchema>;

export const CongregacionalAreaSchema = z.object({
  congregational: CongregationalAnalysisSchema,
  findings: z.array(AnalysisFindingSchema).default([]),
});
export type CongregacionalAreaOutput = z.infer<typeof CongregacionalAreaSchema>;

export type AreaOutput =
  | BiblicalAreaOutput
  | PortuguesAreaOutput
  | ComposicaoAreaOutput
  | CongregacionalAreaOutput;

export function areaSchemaFor(area: Area): z.ZodObject<any> {
  switch (area) {
    case "biblica_teologica":
      return BiblicalAreaSchema;
    case "portugues":
      return PortuguesAreaSchema;
    case "composicao":
      return ComposicaoAreaSchema;
    case "congregacional":
      return CongregacionalAreaSchema;
  }
}

/**
 * Fills in whatever the model got wrong or omitted, one field at a time,
 * instead of discarding the whole response when a single field fails
 * validation (e.g. one bad enum value inside an array). Never throws —
 * the result always satisfies `schema`.
 */
export function coerceObject<T extends Record<string, unknown>>(
  schema: z.ZodObject<any>,
  raw: unknown,
  fallback: T
): T {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const fallbackRecord = fallback as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(schema.shape)) {
    const fieldSchema = schema.shape[key];
    const parsed = fieldSchema.safeParse(source[key]);
    result[key] = parsed.success ? parsed.data : fallbackRecord[key];
  }

  return result as T;
}

// ---- safe fallback content used both when a whole area call fails and to
// backfill individual fields the model got wrong ----

export function biblicalAreaDefaults(): BiblicalAreaOutput {
  return { bibleReferences: [], biblicalContext: [], theologicalClaims: [], findings: [] };
}

export function portuguesAreaDefaults(): PortuguesAreaOutput {
  return { grammarFindings: [], findings: [] };
}

export function composicaoAreaDefaults(request: AnalyzeRequest): ComposicaoAreaOutput {
  return {
    overview: {
      perceivedCentralMessage: "Não foi possível concluir esta parte da análise a tempo.",
      compositionType: "Não determinado",
      mainEmotion: "Não determinado",
      emotionalMovement: "Não determinado",
      likelyAudience: request.context.intendedAudience || "Não determinado",
      likelyUsageContext: request.context.usageContext ?? "Não determinado",
      strengths: ["Não foi possível identificar pontos fortes nesta tentativa."],
      attentionPoints: [],
      consistencyWithStatedIntent: "nao_foi_possivel_determinar",
      consistencyExplanation: "Esta parte da análise não pôde ser concluída a tempo.",
    },
    coherence: {
      messageAppearsClearly: false,
      lyricalSubjectConsistent: true,
      addresseeConsistent: true,
      intensityTrend: "estatica",
      unansweredQuestions: [],
      narrativeMap: { structureType: "poetica" },
      pointOfView: {
        dominantPerson: "Não identificado nesta tentativa.",
        whoSpeaks: "Não identificado nesta tentativa.",
        toWhom: "Não identificado nesta tentativa.",
        shifts: [],
      },
    },
    compositionFindings: [],
    chorusAnalysis: { present: false, candidatePhrases: [] },
    rhymeFindings: [],
    mood: {
      perceivedFunctions: ["reflexiva"],
      lyricalEmotions: ["contemplativa"],
      textualEnergy: "constante",
      movementDescription: "Não determinado nesta tentativa.",
      probableStyleHypotheses: [],
      confidence: "low",
      disclaimer:
        "Esta classificação considera apenas a letra. Arranjo, melodia, harmonia, interpretação e produção podem alterar completamente a percepção musical.",
    },
    findings: [],
  };
}

export function congregacionalAreaDefaults(request: AnalyzeRequest): CongregacionalAreaOutput {
  return {
    congregational: { applicable: request.context.usageContext === "congregacional" },
    findings: [],
  };
}

export function areaDefaults(area: Area, request: AnalyzeRequest): AreaOutput {
  switch (area) {
    case "biblica_teologica":
      return biblicalAreaDefaults();
    case "portugues":
      return portuguesAreaDefaults();
    case "composicao":
      return composicaoAreaDefaults(request);
    case "congregacional":
      return congregacionalAreaDefaults(request);
  }
}

// ---- compact prompts — short format instructions instead of the full JSON Schema ----

function formatSections(sections: SongSection[]): string {
  return sections.map((s) => `[${s.id} | ${s.label}]\n${s.text}`).join("\n\n");
}

const SHARED_RULES =
  "Você é revisor de letras musicais cristãs. Responda SOMENTE com um objeto JSON válido, " +
  "começando em \"{\" e terminando em \"}\", sem texto antes/depois, sem markdown. Nunca escreva " +
  "o texto de um versículo — apenas a referência. Não trate escolha artística como erro. Não " +
  "avalie melodia, BPM ou tonalidade, pois só o texto foi enviado.";

const AREA_FIELD_INSTRUCTIONS: Record<Area, string> = {
  biblica_teologica:
    "Foque só em referências bíblicas prováveis, contexto histórico/literário e afirmações " +
    "teológicas. Campos: bibleReferences (array; cada item: id, excerptFromLyrics, referenceLabel, " +
    "book, chapterStart, verseStart, relationType, proximity, explanation, confidence, " +
    "translationUsed, verseTextAvailable=false), biblicalContext (array; cada item: id, referenceId, " +
    "historicalContext, literaryGenre, literaryUnit, whatComesBefore, whatComesAfter, passageIntent, " +
    "relationToLyrics, usageClassification), theologicalClaims (array; cada item: id, " +
    "excerptFromLyrics, topic, whatItSeemsToAffirm, classification, dependsOnTradition, ambiguous, " +
    "confidence), findings (array; cada item: id, category=\"biblical\" ou \"theological\", " +
    "originalExcerpt, title, explanation, confidence, severity, requiresUserContext). Poucos itens, " +
    "só o genuinamente relevante.",
  portugues:
    "Foque só em português: concordância, regência, conjugação, ambiguidade, pontuação, cacofonia. " +
    "Campos: grammarFindings (array; cada item: id, originalExcerpt, type, explanation, " +
    "poeticLicensePossible, classification), findings (array; cada item: id, category=\"grammar\", " +
    "originalExcerpt, title, explanation, confidence, severity, requiresUserContext). Só ocorrências " +
    "reais, poucos itens.",
  composicao:
    "Foque só em composição: mensagem central, coerência narrativa, refrão, rimas e emoção. Campos " +
    "obrigatórios: overview (perceivedCentralMessage, compositionType, mainEmotion, " +
    "emotionalMovement, likelyAudience, likelyUsageContext, strengths com 1+ item, attentionPoints, " +
    "consistencyWithStatedIntent, consistencyExplanation), coherence (messageAppearsClearly, " +
    "lyricalSubjectConsistent, addresseeConsistent, intensityTrend, narrativeMap{structureType}, " +
    "pointOfView{dominantPerson,whoSpeaks,toWhom}), chorusAnalysis (present, notes), mood " +
    "(perceivedFunctions com 1+ item, lyricalEmotions com 1+ item, textualEnergy, " +
    "movementDescription, confidence). Opcionais: compositionFindings, rhymeFindings, findings " +
    "(category=\"composition\" ou \"artistic_choice\"). Seja direto e conciso.",
  congregacional:
    "Foque só em uso congregacional: clareza coletiva, cantabilidade, vocabulário. Campos: " +
    "congregational (applicable, clarity, singability, vocabulary, notes), findings (array; cada " +
    "item: id, category=\"congregational\", originalExcerpt, title, explanation, confidence, " +
    "severity, requiresUserContext). Seja direto e conciso.",
};

export function areaSystemPrompt(area: Area): string {
  return `${SHARED_RULES} ${AREA_FIELD_INSTRUCTIONS[area]}`;
}

export function areaUserPayload(area: Area, request: AnalyzeRequest, sections: SongSection[]): string {
  return `ÁREA DA ANÁLISE: ${AREA_LABELS[area]}
TRADIÇÃO TEOLÓGICA: ${request.context.theologicalTradition}
NÍVEL DE MUDANÇA DESEJADO: ${request.context.desiredChangeLevel}

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>

Gere somente o objeto JSON desta área. Use os ids de seção entre colchetes (ex.: "${
    sections[0]?.id ?? "sec-1"
  }") no campo sectionId quando aplicável.`;
}

/** Much shorter prompt used only for the single post-timeout retry of one area. */
export function areaRetrySystemPrompt(area: Area): string {
  return `Revisor de letras musicais cristãs, foco em ${AREA_LABELS[area]}. Responda SOMENTE com um JSON conciso conforme pedido, sem texto extra, sem markdown.`;
}

export function areaRetryUserPayload(area: Area, sections: SongSection[]): string {
  return `ÁREA: ${AREA_LABELS[area]}
<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>
Responda rápido e conciso, só o JSON desta área.`;
}
