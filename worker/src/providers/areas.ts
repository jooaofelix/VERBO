import {
  BibleRelationTypeSchema,
  GrammarFindingSchema,
  LyricalEmotionSchema,
  NarrativeStructureTypeSchema,
  ProximitySchema,
  SongFunctionSchema,
  TextualEnergySchema,
  type AIProducedAnalysis,
  type AnalyzeRequest,
  type BibleReference,
  type CompositionFinding,
  type ConfidenceLevel,
  type GrammarFinding,
  type RevisionMode,
  type SongSection,
} from "@verbo/shared";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

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

// ---- minimal, area-specific AI-facing schemas — every field defaults so a
// partial JSON object is still schema-valid on its own; coerceObject() below
// additionally rescues individual wrong-typed fields against these schemas ----

export const BiblicalReferenceTipoSchema = z.enum(["direta", "alusao", "tematica"]);

export const BiblicalAIShapeSchema = z.object({
  mensagemPercebida: z.string().default(""),
  referenciasBiblicas: z
    .array(
      z.object({
        referencia: z.string(),
        relacaoComALetra: z.string().default(""),
        tipo: BiblicalReferenceTipoSchema.default("tematica"),
      })
    )
    .default([]),
  observacoesTeologicas: z.array(z.string()).default([]),
  pontosFortes: z.array(z.string()).default([]),
  alertas: z.array(z.string()).default([]),
});
export type BiblicalAIShape = z.infer<typeof BiblicalAIShapeSchema>;

export const PortuguesAIShapeSchema = z.object({
  correcoes: z
    .array(
      z.object({
        trecho: z.string(),
        problema: z.string().default(""),
        sugestao: z.string().default(""),
      })
    )
    .default([]),
  pontosFortes: z.array(z.string()).default([]),
});
export type PortuguesAIShape = z.infer<typeof PortuguesAIShapeSchema>;

export const ComposicaoAIShapeSchema = z.object({
  estrutura: z.string().default(""),
  classificacaoLirica: z.string().default(""),
  emocao: z.string().default(""),
  energiaTextual: z.string().default(""),
  temaCentral: z.string().default(""),
  observacoesProducao: z.array(z.string()).default([]),
  pontosFortes: z.array(z.string()).default([]),
  sugestoes: z.array(z.string()).default([]),
});
export type ComposicaoAIShape = z.infer<typeof ComposicaoAIShapeSchema>;

export const CongregacionalAIShapeSchema = z.object({
  adequacao: z.string().default(""),
  facilidadeDeCanto: z.string().default(""),
  clarezaDaMensagem: z.string().default(""),
  pontosFortes: z.array(z.string()).default([]),
  sugestoes: z.array(z.string()).default([]),
});
export type CongregacionalAIShape = z.infer<typeof CongregacionalAIShapeSchema>;

export type AreaAIShape = BiblicalAIShape | PortuguesAIShape | ComposicaoAIShape | CongregacionalAIShape;

export function areaAISchemaFor(area: Area): z.ZodObject<any> {
  switch (area) {
    case "biblica_teologica":
      return BiblicalAIShapeSchema;
    case "portugues":
      return PortuguesAIShapeSchema;
    case "composicao":
      return ComposicaoAIShapeSchema;
    case "congregacional":
      return CongregacionalAIShapeSchema;
  }
}

/** All fields at their schema default — used both as the "nothing came back" fallback and as the per-field rescue source. */
export function areaEmptyShape(area: Area): AreaAIShape {
  return areaAISchemaFor(area).parse({}) as AreaAIShape;
}

const AREA_JSON_SCHEMAS: Record<Area, ReturnType<typeof zodToJsonSchema>> = {
  biblica_teologica: zodToJsonSchema(BiblicalAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
  portugues: zodToJsonSchema(PortuguesAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
  composicao: zodToJsonSchema(ComposicaoAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
  congregacional: zodToJsonSchema(CongregacionalAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
};

/** Small, area-specific JSON Schema for Workers AI's native structured-output mode — never the whole AnalysisResult schema. */
export function areaJsonSchema(area: Area): ReturnType<typeof zodToJsonSchema> {
  return AREA_JSON_SCHEMAS[area];
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

// ---- response repair pipeline: strip code fences, extract the first
// balanced JSON object, apply known key aliases, then (re)validate ----

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/** Scans for the first balanced {...} object in the text, ignoring braces inside strings. */
function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Resposta sem objeto JSON.");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }
  throw new Error("Objeto JSON incompleto na resposta.");
}

/** Recovers a JSON value from a raw model response: already-parsed objects pass through; strings get code-fence-stripped and the first balanced object extracted. Throws only if no JSON object can be found at all. */
export function extractJson(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string") throw new Error("Resposta do modelo em formato inesperado.");
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    return extractFirstJsonObject(cleaned);
  }
}

const AREA_KEY_ALIASES: Record<Area, Record<string, string>> = {
  biblica_teologica: {
    mensagem: "mensagemPercebida",
    resumo: "mensagemPercebida",
    mensagem_percebida: "mensagemPercebida",
    referencias: "referenciasBiblicas",
    referencias_biblicas: "referenciasBiblicas",
    bibleReferences: "referenciasBiblicas",
    observacoes: "observacoesTeologicas",
    observacoes_teologicas: "observacoesTeologicas",
    teologia: "observacoesTeologicas",
    pontos_fortes: "pontosFortes",
    strengths: "pontosFortes",
    avisos: "alertas",
    alerts: "alertas",
  },
  portugues: {
    correcoes_gramaticais: "correcoes",
    erros: "correcoes",
    grammarFindings: "correcoes",
    pontos_fortes: "pontosFortes",
    strengths: "pontosFortes",
  },
  composicao: {
    estrutura_lirica: "estrutura",
    structure: "estrutura",
    classificacao: "classificacaoLirica",
    classificacao_lirica: "classificacaoLirica",
    emocao_predominante: "emocao",
    emotion: "emocao",
    energia: "energiaTextual",
    energia_textual: "energiaTextual",
    textualEnergy: "energiaTextual",
    tema: "temaCentral",
    tema_central: "temaCentral",
    observacoes_producao: "observacoesProducao",
    producao: "observacoesProducao",
    pontos_fortes: "pontosFortes",
    strengths: "pontosFortes",
    sugestao: "sugestoes",
    suggestions: "sugestoes",
  },
  congregacional: {
    adequacao_congregacional: "adequacao",
    facilidade_de_canto: "facilidadeDeCanto",
    facilidade_canto: "facilidadeDeCanto",
    singability: "facilidadeDeCanto",
    clareza: "clarezaDaMensagem",
    clareza_da_mensagem: "clarezaDaMensagem",
    pontos_fortes: "pontosFortes",
    strengths: "pontosFortes",
    sugestao: "sugestoes",
    suggestions: "sugestoes",
  },
};

/** Renames a handful of common alternate key names a small model might use onto the canonical field names, without overwriting a key the model already got right. */
export function applyAreaAliases(raw: unknown, area: Area): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const source = raw as Record<string, unknown>;
  const aliasMap = AREA_KEY_ALIASES[area];
  const result: Record<string, unknown> = { ...source };
  for (const [aliasKey, canonicalKey] of Object.entries(aliasMap)) {
    if (aliasKey in source && !(canonicalKey in source)) {
      result[canonicalKey] = source[aliasKey];
    }
  }
  return result;
}

// ---- compact prompts — structured output enforces the shape, so these only
// need to describe what content belongs in each field ----

function formatSections(sections: SongSection[]): string {
  return sections.map((s) => `[${s.id} | ${s.label}]\n${s.text}`).join("\n\n");
}

const AREA_FOCUS: Record<Area, string> = {
  biblica_teologica:
    "Identifique referências bíblicas prováveis (ex.: \"Salmos 23:1\"), sua relação com a letra e o tipo " +
    "(direta, alusão ou temática), observações teológicas e pontos fortes. Nunca escreva o texto do " +
    "versículo, apenas a referência.",
  portugues:
    "Revise a letra em português: concordância, regência, conjugação, ambiguidade, pontuação, cacofonia. " +
    "Para cada correção, cite o trecho exato, o problema e uma sugestão. Aponte também pontos fortes.",
  composicao:
    "Analise a composição: estrutura, classificação lírica, emoção predominante, energia textual, tema " +
    "central, observações de produção, pontos fortes e sugestões.",
  congregacional:
    "Avalie o uso congregacional: adequação, facilidade de canto, clareza da mensagem, pontos fortes e " +
    "sugestões.",
};

export function areaUserPayload(area: Area, _request: AnalyzeRequest, sections: SongSection[]): string {
  return `${AREA_FOCUS[area]}

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>`;
}

export function areaRetryUserPayload(area: Area, sections: SongSection[]): string {
  return `${AREA_FOCUS[area]} Seja breve.

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>`;
}

export const AREA_SYSTEM_PROMPT =
  "Você é revisor de letras musicais cristãs (bíblia, teologia, português, composição, uso " +
  "congregacional). Nunca escreva o texto de um versículo bíblico — apenas a referência. Não " +
  "trate escolha artística como erro. Não avalie melodia, BPM ou tonalidade, pois só o texto foi " +
  "enviado. Preencha apenas os campos pedidos.";

export const AREA_SYSTEM_PROMPT_RETRY =
  "Revisor de letras musicais cristãs. Nunca escreva o texto de um versículo. Seja breve e direto.";

// ---- normalization helpers used only when merging AI output into the
// final AnalysisResult shape ----

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

const DISPLAY_ACCENT_FIXES: Record<string, string> = {
  poetica: "poética",
  liturgica: "litúrgica",
  estatica: "estática",
  media: "média",
};

/** Restores accents on a small set of words a model sometimes drops, without touching text it already got right. */
function normalizeDisplayValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase();
  return DISPLAY_ACCENT_FIXES[key] ?? trimmed;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function matchEnumOrFallback<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: [T, ...T[]]
): [T, ...T[]] {
  if (!value) return fallback;
  const normalized = normalizeToken(value);
  const match = options.find((o) => o === normalized);
  return match ? [match] : fallback;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Parses a free-text reference label like "Salmo 126:5" or "Romanos 8:28-30" into its structured parts. Returns null if it doesn't look like a reference at all. */
export function parseReferenceLabel(
  label: string
): { book: string; chapterStart: number; verseStart: number; chapterEnd?: number; verseEnd?: number } | null {
  const trimmed = label.trim();
  const match = trimmed.match(/^([1-3]?\s?[A-Za-zÀ-ÿ.]+(?:\s[A-Za-zÀ-ÿ.]+)*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\s*$/);
  if (!match) return null;
  const [, book, chapter, verse, verseEnd] = match;
  return {
    book: book.trim(),
    chapterStart: Number(chapter),
    verseStart: verse ? Number(verse) : 1,
    verseEnd: verseEnd ? Number(verseEnd) : undefined,
  };
}

function mapTipoToRelationType(tipo: string | undefined): z.infer<typeof BibleRelationTypeSchema> {
  switch (tipo) {
    case "direta":
      return "citacao_direta";
    case "alusao":
      return "alusao";
    case "tematica":
      return "tema_biblico_geral";
    default:
      return "tema_biblico_geral";
  }
}

function proximityForTipo(tipo: string | undefined): z.infer<typeof ProximitySchema> {
  switch (tipo) {
    case "direta":
      return "alta";
    case "alusao":
      return "media";
    default:
      return "baixa";
  }
}

function confidenceForTipo(tipo: string | undefined): ConfidenceLevel {
  switch (tipo) {
    case "direta":
      return "high";
    case "alusao":
      return "medium";
    default:
      return "low";
  }
}

function mapBiblicalReferences(
  items: BiblicalAIShape["referenciasBiblicas"],
  request: AnalyzeRequest
): BibleReference[] {
  return items
    .filter((item) => item.referencia && item.referencia.trim().length > 0)
    .map((item, i) => {
      const parsed = parseReferenceLabel(item.referencia);
      return {
        id: `ai-ref-${i}-${slugify(item.referencia)}`,
        excerptFromLyrics: item.relacaoComALetra || item.referencia,
        referenceLabel: item.referencia.trim(),
        book: parsed?.book ?? item.referencia.trim(),
        chapterStart: parsed?.chapterStart ?? 1,
        verseStart: parsed?.verseStart ?? 1,
        chapterEnd: parsed?.chapterEnd,
        verseEnd: parsed?.verseEnd,
        relationType: mapTipoToRelationType(item.tipo),
        proximity: proximityForTipo(item.tipo),
        explanation: item.relacaoComALetra || "Relação identificada pela análise.",
        confidence: confidenceForTipo(item.tipo),
        translationUsed: request.bibleTranslationPreference,
        verseTextAvailable: false,
      };
    });
}

function toGeneralFindings(
  texts: string[],
  category: "theological" | "composition" | "congregational",
  severity: "observation" | "attention",
  idPrefix: string
) {
  return texts
    .filter((t) => t && t.trim().length > 0)
    .map((t, i) => ({
      id: `${idPrefix}-${i}`,
      category,
      originalExcerpt: "(observação geral)",
      title: t.length > 60 ? `${t.slice(0, 57)}...` : t,
      explanation: t,
      confidence: "medium" as const,
      severity,
      requiresUserContext: false,
    }));
}

export interface AreaShapes {
  biblica_teologica?: BiblicalAIShape;
  portugues?: PortuguesAIShape;
  composicao?: ComposicaoAIShape;
  congregacional?: CongregacionalAIShape;
}

/**
 * Combines whichever area outputs actually came back (partial or complete)
 * into the full AIProducedAnalysis shape the rest of the app expects.
 * Every field follows the same rule: pick the first genuinely non-empty
 * source, in priority order, and only fall back to placeholder text when
 * every source was empty — never concatenate a fallback with real data.
 */
export function mergeAreasIntoAnalysis(request: AnalyzeRequest, shapes: AreaShapes): AIProducedAnalysis {
  const biblical = shapes.biblica_teologica;
  const portugues = shapes.portugues;
  const composicao = shapes.composicao;
  const congregacional = shapes.congregacional;

  const messagePerceived =
    firstNonEmpty(biblical?.mensagemPercebida, composicao?.temaCentral) ??
    "Não foi possível determinar a mensagem central nesta análise.";

  const structureDisplay = composicao?.estrutura?.trim()
    ? normalizeDisplayValue(composicao.estrutura)
    : "Não determinado";

  const perceivedFunctions = matchEnumOrFallback(
    composicao?.classificacaoLirica,
    SongFunctionSchema.options,
    ["reflexiva"]
  );

  const emotionDisplay = composicao?.emocao?.trim() ? normalizeDisplayValue(composicao.emocao) : "Não determinado";
  const lyricalEmotions = matchEnumOrFallback(composicao?.emocao, LyricalEmotionSchema.options, ["contemplativa"]);

  const [textualEnergy] = matchEnumOrFallback(composicao?.energiaTextual, TextualEnergySchema.options, [
    "constante",
  ]);

  const [structureType] = matchEnumOrFallback(composicao?.estrutura, NarrativeStructureTypeSchema.options, [
    "poetica",
  ]);

  const productionNotes = (composicao?.observacoesProducao ?? []).filter((s) => s.trim().length > 0);

  const bibleReferences = mapBiblicalReferences(biblical?.referenciasBiblicas ?? [], request);

  const grammarFindings: GrammarFinding[] = (portugues?.correcoes ?? [])
    .filter((c) => c.trecho && c.trecho.trim().length > 0)
    .map((c, i) => {
      const finding: GrammarFinding = {
        id: `gram-${i}-${slugify(c.trecho)}`,
        originalExcerpt: c.trecho,
        type: "construcao_pouco_natural",
        explanation: c.problema || c.trecho,
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "ia",
      };
      if (c.sugestao) finding.possibleCorrection = c.sugestao;
      return GrammarFindingSchema.parse(finding);
    });

  const compositionFindings: CompositionFinding[] = (composicao?.sugestoes ?? [])
    .filter((s) => s && s.trim().length > 0)
    .map((s, i) => ({
      id: `comp-${i}`,
      aspect: "imagem_original",
      observation: s,
      isStrength: false,
      suggestion: s,
    }));

  const congregationalNotes = firstNonEmpty(congregacional?.adequacao);
  const congregational = {
    applicable: request.context.usageContext === "congregacional",
    notes: congregationalNotes,
    clarity: firstNonEmpty(congregacional?.clarezaDaMensagem),
    singability: firstNonEmpty(congregacional?.facilidadeDeCanto),
  };

  const strengthsUnion = dedupe([
    ...(biblical?.pontosFortes ?? []),
    ...(portugues?.pontosFortes ?? []),
    ...(composicao?.pontosFortes ?? []),
    ...(congregacional?.pontosFortes ?? []),
  ]);
  const strengths = strengthsUnion.length > 0 ? strengthsUnion : ["Não foi possível identificar pontos fortes nesta análise."];

  const findings = [
    ...toGeneralFindings(biblical?.observacoesTeologicas ?? [], "theological", "observation", "theo-obs"),
    ...toGeneralFindings(biblical?.alertas ?? [], "theological", "attention", "theo-alert"),
    ...toGeneralFindings(composicao?.sugestoes ?? [], "composition", "observation", "comp-sug"),
    ...toGeneralFindings(congregacional?.sugestoes ?? [], "congregational", "observation", "cong-sug"),
  ];

  const movementDescription =
    productionNotes.length > 0
      ? productionNotes.join(" ")
      : "Sem observações de produção adicionais para este texto.";

  const chorusPresent = false;

  return {
    overview: {
      perceivedCentralMessage: messagePerceived,
      compositionType: structureDisplay,
      mainEmotion: emotionDisplay,
      emotionalMovement: structureDisplay,
      likelyAudience: request.context.intendedAudience || "Não determinado",
      likelyUsageContext: request.context.usageContext ?? "Não determinado",
      strengths,
      attentionPoints: dedupe(biblical?.alertas ?? []),
      consistencyWithStatedIntent: "nao_foi_possivel_determinar",
      consistencyExplanation: "Consistência com a intenção declarada não é avaliada nesta versão da análise.",
    },
    bibleReferences,
    biblicalContext: [],
    theologicalClaims: [],
    coherence: {
      messageAppearsClearly: Boolean(messagePerceived),
      lyricalSubjectConsistent: true,
      addresseeConsistent: true,
      intensityTrend: "estatica",
      unansweredQuestions: [],
      narrativeMap: { structureType },
      pointOfView: {
        dominantPerson: "Não avaliado nesta versão da análise.",
        whoSpeaks: "Não avaliado nesta versão da análise.",
        toWhom: "Não avaliado nesta versão da análise.",
        shifts: [],
      },
    },
    grammarFindings,
    compositionFindings,
    chorusAnalysis: { present: chorusPresent, candidatePhrases: [] },
    rhymeFindings: [],
    mood: {
      perceivedFunctions,
      lyricalEmotions,
      textualEnergy,
      movementDescription,
      probableStyleHypotheses: [],
      confidence: "medium",
      disclaimer:
        "Esta classificação considera apenas a letra. Arranjo, melodia, harmonia, interpretação e produção podem alterar completamente a percepção musical.",
    },
    congregational,
    composerQuestions: [],
    findings,
    limitations: [],
    disclaimers: [],
    sectionStatus: {},
  };
}
