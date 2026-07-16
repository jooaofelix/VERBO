import { z } from "zod";

/**
 * Shared contract between web and server. Every AI-produced structure is
 * validated against these schemas before it reaches the UI or a report.
 */

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);

export const FindingSeveritySchema = z.enum([
  "strength",
  "observation",
  "attention",
  "probable_error",
  "theological_discussion",
]);

export const HighlightCategorySchema = z.enum([
  "biblical",
  "theological",
  "grammar",
  "composition",
  "artistic_choice",
  "congregational",
]);

export const SectionStatusValueSchema = z.object({
  status: z.enum(["ok", "indisponivel"]),
  mensagem: z.string().optional(),
});

export const AnalysisFindingSchema = z.object({
  id: z.string(),
  category: HighlightCategorySchema,
  sectionId: z.string().optional(),
  originalExcerpt: z.string(),
  title: z.string(),
  explanation: z.string(),
  suggestion: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  confidence: ConfidenceLevelSchema,
  severity: FindingSeveritySchema,
  requiresUserContext: z.boolean(),
});

export const SongSectionTypeSchema = z.enum([
  "introducao",
  "verso",
  "pre_refrao",
  "refrao",
  "pos_refrao",
  "ponte",
  "interludio",
  "final",
  "fala",
  "outro",
]);

export const SongSectionSchema = z.object({
  id: z.string(),
  type: SongSectionTypeSchema,
  index: z.number().int().nonnegative().optional(),
  label: z.string(),
  text: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
});

export const BibleRelationTypeSchema = z.enum([
  "citacao_direta",
  "citacao_adaptada",
  "parafrase",
  "alusao",
  "imagem_biblica",
  "tema_biblico_geral",
  "afirmacao_doutrinaria",
  "sem_referencia",
]);

export const ProximitySchema = z.enum(["alta", "media", "baixa"]);

export const BibleReferenceSchema = z.object({
  id: z.string(),
  excerptFromLyrics: z.string(),
  referenceLabel: z.string(), // e.g. "Salmos 84:1-2"
  book: z.string(),
  chapterStart: z.number().int().positive(),
  verseStart: z.number().int().positive(),
  chapterEnd: z.number().int().positive().optional(),
  verseEnd: z.number().int().positive().optional(),
  relationType: BibleRelationTypeSchema,
  proximity: ProximitySchema,
  explanation: z.string(),
  confidence: ConfidenceLevelSchema,
  translationUsed: z.string(),
  verseText: z.string().optional(),
  verseTextAvailable: z.boolean(),
  attribution: z.string().optional(),
});

export const BiblicalUsageClassificationSchema = z.enum([
  "coerente_com_contexto",
  "aplicacao_possivel",
  "aplicacao_devocional",
  "relacao_tematica_indireta",
  "interpretacao_discutivel",
  "possivel_uso_fora_de_contexto",
  "referencia_insuficiente",
]);

export const BiblicalContextAnalysisSchema = z.object({
  id: z.string(),
  referenceId: z.string(),
  originalAuthorOrTradition: z.string().optional(),
  originalAudience: z.string().optional(),
  historicalContext: z.string(),
  literaryGenre: z.string(),
  literaryUnit: z.string(),
  whatComesBefore: z.string(),
  whatComesAfter: z.string(),
  passageIntent: z.string(),
  relationToLyrics: z.string(),
  contextRisk: z.string().optional(),
  usageClassification: BiblicalUsageClassificationSchema,
});

export const TheologicalTopicSchema = z.enum([
  "deus",
  "trindade",
  "pessoa_e_obra_de_cristo",
  "cruz",
  "ressurreicao",
  "salvacao",
  "graca",
  "fe",
  "arrependimento",
  "santificacao",
  "igreja",
  "espirito_santo",
  "adoracao",
  "sofrimento",
  "cura",
  "promessas",
  "reino_de_deus",
  "escatologia",
  "identidade_humana",
  "pecado",
  "livre_arbitrio",
  "soberania",
  "batalha_espiritual",
  "outro",
]);

export const TheologicalClassificationSchema = z.enum([
  "afirmacao_crista_central",
  "amplamente_compativel",
  "interpretacao_teologica_possivel",
  "dependente_de_tradicao",
  "ambigua",
  "precisa_de_contexto",
  "potencialmente_problematica",
  "contraria_ao_texto_biblico_citado",
]);

export const AlternateInterpretationSchema = z.object({
  interpretation: z.string(),
  associatedTraditions: z.array(z.string()),
});

export const TheologicalClaimSchema = z.object({
  id: z.string(),
  excerptFromLyrics: z.string(),
  sectionId: z.string().optional(),
  topic: TheologicalTopicSchema,
  whatItSeemsToAffirm: z.string(),
  possibleBiblicalBasis: z.array(z.string()).default([]),
  classification: TheologicalClassificationSchema,
  dependsOnTradition: z.boolean(),
  traditionNotes: z.string().optional(),
  alternateInterpretations: z.array(AlternateInterpretationSchema).default([]),
  ambiguous: z.boolean(),
  howDifferentListenersMightInterpret: z.string().optional(),
  riskOfMiscommunication: z.string().optional(),
  confidence: ConfidenceLevelSchema,
});

export const GrammarFindingTypeSchema = z.enum([
  "ortografia",
  "acentuacao",
  "pontuacao",
  "concordancia_verbal",
  "concordancia_nominal",
  "regencia",
  "colocacao_pronominal",
  "conjugacao_verbal",
  "consistencia_tempos_verbais",
  "ambiguidade",
  "repeticao_involuntaria",
  "pleonasmo",
  "cacofonia",
  "construcao_pouco_natural",
  "palavra_dificil_de_cantar",
  "frase_longa",
]);

export const GrammarClassificationSchema = z.enum([
  "erro_provavel",
  "liberdade_poetica_funcional",
  "liberdade_poetica_confusa",
  "escolha_estilistica",
  "nao_determinado_sem_melodia",
]);

export const GrammarFindingSchema = z.object({
  id: z.string(),
  sectionId: z.string().optional(),
  originalExcerpt: z.string(),
  type: GrammarFindingTypeSchema,
  explanation: z.string(),
  possibleCorrection: z.string().optional(),
  metricImpact: z.string().optional(),
  poeticLicensePossible: z.boolean(),
  classification: GrammarClassificationSchema,
  source: z.enum(["deterministico", "ia"]).default("ia"),
});

export const CompositionAspectSchema = z.enum([
  "primeira_frase",
  "clareza_do_tema",
  "desenvolvimento_dos_versos",
  "preparacao_pre_refrao",
  "impacto_do_refrao",
  "memorabilidade",
  "relacao_titulo_refrao",
  "uso_de_repeticao",
  "contraste_entre_secoes",
  "funcao_da_ponte",
  "encerramento",
  "quantidade_de_informacao",
  "cliche",
  "imagem_original",
  "campo_semantico",
  "unidade_poetica",
  "funcao_de_secao_ausente",
]);

export const CompositionFindingSchema = z.object({
  id: z.string(),
  aspect: CompositionAspectSchema,
  sectionId: z.string().optional(),
  observation: z.string(),
  isStrength: z.boolean(),
  suggestion: z.string().optional(),
});

export const ChorusCandidatePhraseSchema = z.object({
  text: z.string(),
  function: z.enum(["titulo", "gancho", "centro_emocional", "centro_teologico"]),
});

export const ChorusAnalysisSchema = z.object({
  present: z.boolean(),
  summarizesMessage: z.boolean().optional(),
  memorable: z.boolean().optional(),
  hasCentralPhrase: z.boolean().optional(),
  titleAppears: z.boolean().optional(),
  standsAlone: z.boolean().optional(),
  strongerThanVerses: z.boolean().optional(),
  tooAbstract: z.boolean().optional(),
  tooMuchInformation: z.boolean().optional(),
  easyToRepeat: z.boolean().optional(),
  fitsIntendedMood: z.boolean().optional(),
  goodForCollectiveSinging: z.boolean().optional(),
  repetitionStrengthensMessage: z.boolean().optional(),
  candidatePhrases: z.array(ChorusCandidatePhraseSchema).default([]),
  notes: z.string().optional(),
});

export const ProsodyFindingSchema = z.object({
  id: z.string(),
  sectionId: z.string().optional(),
  lineText: z.string(),
  approxSyllableCount: z.number().int().nonnegative(),
  lineLengthClass: z.enum(["curta", "media", "longa"]),
  difficultConsonantClusters: z.array(z.string()).default([]),
  vowelSequences: z.array(z.string()).default([]),
  fluencyNote: z.string(),
});

export const RhymeTypeSchema = z.enum([
  "perfeita",
  "imperfeita",
  "interna",
  "assonancia",
  "aliteracao",
  "ausente",
  "previsivel",
  "forcada",
  "altera_mensagem",
]);

export const RhymeFindingSchema = z.object({
  id: z.string(),
  lines: z.array(z.string()),
  type: RhymeTypeSchema,
  note: z.string(),
});

export const SongFunctionSchema = z.enum([
  "congregacional",
  "devocional",
  "artistica",
  "testemunhal",
  "evangelistica",
  "liturgica",
  "narrativa",
  "reflexiva",
  "exortativa",
  "oracao_cantada",
  "declaracao_de_fe",
  "celebracao",
  "lamento",
]);

export const LyricalEmotionSchema = z.enum([
  "alegre",
  "esperancosa",
  "intensa",
  "contemplativa",
  "melancolica",
  "vulneravel",
  "triunfante",
  "reverente",
  "epica",
  "intima",
  "confessional",
  "tensa",
  "serena",
  "celebrativa",
]);

export const TextualEnergySchema = z.enum([
  "baixa",
  "media",
  "alta",
  "crescente",
  "decrescente",
  "constante",
  "contrastante",
]);

export const MoodAnalysisSchema = z.object({
  perceivedFunctions: z.array(SongFunctionSchema).min(1),
  lyricalEmotions: z.array(LyricalEmotionSchema).min(1),
  textualEnergy: TextualEnergySchema,
  movementDescription: z.string(),
  probableStyleHypotheses: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
  disclaimer: z
    .string()
    .default(
      "Esta classificação considera apenas a letra. Arranjo, melodia, harmonia, interpretação e produção podem alterar completamente a percepção musical."
    ),
});

export const CongregationalAnalysisSchema = z.object({
  applicable: z.boolean(),
  clarity: z.string().optional(),
  godCenteredness: z.string().optional(),
  comprehensionWithoutExplanation: z.string().optional(),
  memorization: z.string().optional(),
  repetitionNote: z.string().optional(),
  lineLength: z.string().optional(),
  vocabulary: z.string().optional(),
  theologicalTermsUsage: z.string().optional(),
  individualVsCollectivePerspective: z.string().optional(),
  singability: z.string().optional(),
  wordsPerLine: z.string().optional(),
  vocalInterpretationDependency: z.string().optional(),
  needsComposerBackstory: z.boolean().optional(),
  ambiguityWhenSungByCommunity: z.string().optional(),
  personalVsSharedTruthBalance: z.string().optional(),
  simplicityVsDensityNote: z.string().optional(),
  notes: z.string().optional(),
});

export const NarrativeStructureTypeSchema = z.enum([
  "narrativa",
  "circular",
  "contemplativa",
  "declarativa",
  "liturgica",
  "confessional",
  "poetica",
  "exortativa",
  "testemunhal",
]);

export const NarrativeMapSchema = z.object({
  startingPoint: z.string().optional(),
  conflictOrTension: z.string().optional(),
  development: z.string().optional(),
  revelation: z.string().optional(),
  response: z.string().optional(),
  conclusion: z.string().optional(),
  structureType: NarrativeStructureTypeSchema,
});

export const PointOfViewShiftSchema = z.object({
  fromSectionId: z.string().optional(),
  toSectionId: z.string().optional(),
  from: z.string(),
  to: z.string(),
  note: z.string(),
});

export const PointOfViewSchema = z.object({
  dominantPerson: z.string(),
  whoSpeaks: z.string(),
  toWhom: z.string(),
  aboutWhom: z.string().optional(),
  shifts: z.array(PointOfViewShiftSchema).default([]),
});

export const IntensityTrendSchema = z.enum([
  "crescente",
  "decrescente",
  "estatica",
  "irregular",
]);

export const CoherenceAnalysisSchema = z.object({
  messageAppearsClearly: z.boolean(),
  chorusRepresentsCentralIdea: z.boolean().optional(),
  versesDevelopMessage: z.boolean().optional(),
  bridgeAddsOrRepeats: z.enum(["acrescenta", "repete", "nao_ha_ponte"]).optional(),
  endingDeliversPayoff: z.boolean().optional(),
  topicShiftDetected: z.string().optional(),
  contradictionDetected: z.string().optional(),
  lyricalSubjectConsistent: z.boolean(),
  addresseeConsistent: z.boolean(),
  intensityTrend: IntensityTrendSchema,
  unansweredQuestions: z.array(z.string()).default([]),
  mainImageDeveloped: z.boolean().optional(),
  narrativeMap: NarrativeMapSchema,
  pointOfView: PointOfViewSchema,
});

export const ConsistencyLevelSchema = z.enum([
  "muito_consistente",
  "consistente",
  "parcialmente_consistente",
  "precisa_revisao",
  "nao_foi_possivel_determinar",
]);

export const OverviewSummarySchema = z.object({
  perceivedCentralMessage: z.string(),
  compositionType: z.string(),
  mainEmotion: z.string(),
  emotionalMovement: z.string(),
  likelyAudience: z.string(),
  likelyUsageContext: z.string(),
  strengths: z.array(z.string()).min(1),
  attentionPoints: z.array(z.string()).default([]),
  consistencyWithStatedIntent: ConsistencyLevelSchema,
  consistencyExplanation: z.string(),
});

export const ComposerQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  relatedExcerpt: z.string().optional(),
  relatedSectionId: z.string().optional(),
});

export const RevisionModeSchema = z.enum([
  "rapida",
  "biblica_teologica",
  "composicao",
  "portugues",
  "congregacional",
  "completa",
]);

export const TheologicalTraditionSchema = z.enum([
  "geral",
  "evangelica_ampla",
  "protestante_historica",
  "reformada",
  "pentecostal",
  "batista",
  "wesleyana_arminiana",
  "catolica",
  "ortodoxa",
  "outra",
  "nao_selecionar",
]);

export const DesiredChangeLevelSchema = z.enum([
  "apontar_problemas",
  "pequenas_correcoes",
  "refinar_mantendo_voz",
  "mudancas_criativas",
  "versao_alternativa_completa",
]);

export const SongContextInputSchema = z.object({
  centralMessage: z.string().optional(),
  desiredUnderstanding: z.string().optional(),
  backstory: z.string().optional(),
  centralPhrase: z.string().optional(),
  lyricsForm: z
    .enum(["oracao", "declaracao", "narrativa", "testemunho", "reflexao", "convite", "nao_sei"])
    .optional(),
  speaksTo: z
    .enum(["deus", "sobre_deus", "igreja", "uma_pessoa", "consigo_mesmo", "nao_sei"])
    .optional(),
  isChristian: z.boolean().optional(),
  isExplicitlyBiblical: z.boolean().optional(),
  usageContext: z
    .enum([
      "culto",
      "congregacional",
      "artistica_lancamento",
      "devocional",
      "evangelizacao",
      "criancas",
      "outro",
      "nao_sei",
    ])
    .optional(),
  intendedAudience: z.string().optional(),
  theologicalTradition: TheologicalTraditionSchema.default("nao_selecionar"),
  intendedStyle: z.string().optional(),
  intendedMood: z.string().optional(),
  hasReferenceTrack: z.boolean().optional(),
  bibleReferencesProvidedByUser: z.array(z.string()).default([]),
  desiredChangeLevel: DesiredChangeLevelSchema.default("refinar_mantendo_voz"),
});

export const AnalyzeRequestSchema = z.object({
  songTitle: z.string().optional(),
  author: z.string().optional(),
  lyrics: z.string().min(1, "A letra não pode estar vazia."),
  sections: z.array(SongSectionSchema).default([]),
  context: SongContextInputSchema,
  revisionMode: RevisionModeSchema.default("completa"),
  bibleTranslationPreference: z.string().default("dominio_publico_almeida"),
});

export const FinalReportSchema = z.object({
  songTitle: z.string().optional(),
  author: z.string().optional(),
  versionName: z.string(),
  analyzedAt: z.string(),
  declaredIntent: z.string(),
  perceivedMessage: z.string(),
  structureOverview: z.string(),
  lyricalClassification: z.string(),
  emotion: z.string(),
  bibleReferences: z.array(BibleReferenceSchema).default([]),
  biblicalContextNotes: z.array(z.string()).default([]),
  theologicalObservations: z.array(z.string()).default([]),
  linguisticObservations: z.array(z.string()).default([]),
  compositionObservations: z.array(z.string()).default([]),
  productionObservations: z.array(z.string()).default([]),
  congregationalFit: z.string(),
  strengths: z.array(z.string()).default([]),
  attentionPoints: z.array(z.string()).default([]),
  pendingQuestions: z.array(z.string()).default([]),
  prioritySuggestions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  originalLyrics: z.string(),
  revisedLyrics: z.string().optional(),
});

export const AnalysisResultSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  revisionMode: RevisionModeSchema,
  overview: OverviewSummarySchema,
  bibleReferences: z.array(BibleReferenceSchema).default([]),
  biblicalContext: z.array(BiblicalContextAnalysisSchema).default([]),
  theologicalClaims: z.array(TheologicalClaimSchema).default([]),
  coherence: CoherenceAnalysisSchema,
  grammarFindings: z.array(GrammarFindingSchema).default([]),
  compositionFindings: z.array(CompositionFindingSchema).default([]),
  chorusAnalysis: ChorusAnalysisSchema,
  prosodyFindings: z.array(ProsodyFindingSchema).default([]),
  rhymeFindings: z.array(RhymeFindingSchema).default([]),
  mood: MoodAnalysisSchema,
  congregational: CongregationalAnalysisSchema,
  composerQuestions: z.array(ComposerQuestionSchema).default([]),
  findings: z.array(AnalysisFindingSchema).default([]),
  limitations: z.array(z.string()).default([]),
  disclaimers: z.array(z.string()).default([]),
  /**
   * Per-area availability for revisionMode "completa" (and the individual
   * area modes), keyed by area ("biblica_teologica" | "portugues" |
   * "composicao" | "congregacional"). Only areas that could not be produced
   * in time appear here — a fully successful analysis has an empty object.
   * Lets the UI show a partial report instead of failing outright when one
   * area of a multi-call analysis times out.
   */
  sectionStatus: z.record(z.string(), SectionStatusValueSchema).default({}),
});

/**
 * The subset of AnalysisResultSchema that the AI provider is responsible
 * for producing. `id`, `createdAt` and `revisionMode` are assigned by the
 * server. `prosodyFindings` is deliberately excluded — syllable/line-length
 * estimates are computed deterministically from the raw text, never by the
 * model, so a syllable count can never be an AI hallucination.
 */
export const AIProducedAnalysisSchema = z.object({
  overview: OverviewSummarySchema,
  bibleReferences: z.array(BibleReferenceSchema).default([]),
  biblicalContext: z.array(BiblicalContextAnalysisSchema).default([]),
  theologicalClaims: z.array(TheologicalClaimSchema).default([]),
  coherence: CoherenceAnalysisSchema,
  grammarFindings: z.array(GrammarFindingSchema).default([]),
  compositionFindings: z.array(CompositionFindingSchema).default([]),
  chorusAnalysis: ChorusAnalysisSchema,
  rhymeFindings: z.array(RhymeFindingSchema).default([]),
  mood: MoodAnalysisSchema,
  congregational: CongregationalAnalysisSchema,
  composerQuestions: z.array(ComposerQuestionSchema).default([]),
  findings: z.array(AnalysisFindingSchema).default([]),
  limitations: z.array(z.string()).default([]),
  disclaimers: z.array(z.string()).default([]),
  sectionStatus: z.record(z.string(), SectionStatusValueSchema).default({}),
});

export const AnalyzeResponseSchema = z.object({
  mode: z.enum(["live", "demo"]),
  result: AnalysisResultSchema,
});

export const BibleLookupResponseSchema = z.object({
  found: z.boolean(),
  referenceLabel: z.string(),
  text: z.string().optional(),
  translation: z.string().optional(),
  attribution: z.string().optional(),
  note: z.string().optional(),
});
