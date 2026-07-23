import {
  BibleRelationTypeSchema,
  GrammarFindingSchema,
  GrammarFindingTypeSchema,
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

export const PortuguesCorrecaoTipoSchema = z.enum([
  "ortografia",
  "concordancia",
  "regencia",
  "pontuacao",
  "clareza",
  "coerencia",
  "pessoa_verbal",
  "fluidez",
  "prosodia",
]);

export const PortuguesGravidadeSchema = z.enum(["baixa", "media", "alta"]);

export const PortuguesAIShapeSchema = z.object({
  resumo: z.string().default(""),
  correcoes: z
    .array(
      z.object({
        trechoOriginal: z.string(),
        tipo: PortuguesCorrecaoTipoSchema.default("clareza"),
        gravidade: PortuguesGravidadeSchema.default("media"),
        explicacao: z.string().default(""),
        opcao1: z.string().default(""),
        opcao2: z.string().default(""),
        observacaoDeSentido: z.string().default(""),
      })
    )
    .default([]),
  problemasDeConsistencia: z.array(z.string()).default([]),
  pontosFortes: z.array(z.string()).default([]),
  prioridades: z.array(z.string()).default([]),
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

/**
 * When Workers AI's max_tokens budget cuts the model off mid-object, the
 * JSON is truncated but everything generated before the cut is usually
 * still well-formed. Rather than discard the whole response (and every
 * already-complete correção/referência/observação in it), this trims back
 * to the last point where doing so still yields valid JSON — right before a
 * dangling comma, or right after a container that had already fully
 * closed — and closes off whatever brackets were still open at that point.
 * Returns undefined if nothing was salvageable at all.
 */
function repairTruncatedJson(text: string, start: number): unknown {
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escape = false;
  let cut = -1;
  let cutStack: Array<"{" | "["> = [];

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
    if (ch === "{" || ch === "[") {
      // Opening a container is deliberately NOT recorded as a safe cut
      // point: an object that never got far enough to include its own
      // required fields (e.g. a correção missing trechoOriginal) would
      // otherwise survive as a syntactically-valid-but-incomplete item and
      // invalidate the whole array once it fails schema validation. Only
      // cutting at a point where the current value had already fully
      // finished (a comma, or a container that already closed) guarantees
      // every salvaged item is exactly as complete as the model left it.
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      cut = i + 1;
      cutStack = [...stack];
    } else if (ch === ",") {
      cut = i;
      cutStack = [...stack];
    }
  }

  if (cut === -1) return undefined;

  const closing = cutStack
    .slice()
    .reverse()
    .map((bracket) => (bracket === "{" ? "}" : "]"))
    .join("");

  try {
    return JSON.parse(text.slice(start, cut) + closing);
  } catch {
    return undefined;
  }
}

/** Scans for the first balanced {...} object in the text, ignoring braces inside strings. Falls back to repairTruncatedJson() before giving up. */
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

  const repaired = repairTruncatedJson(text, start);
  if (repaired !== undefined) return repaired;
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
    resumo_geral: "resumo",
    summary: "resumo",
    problemas_de_consistencia: "problemasDeConsistencia",
    consistencia: "problemasDeConsistencia",
    prioridades_de_correcao: "prioridades",
    priorities: "prioridades",
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
    "versículo, apenas a referência. Nos pontos fortes, cite elementos concretos da letra (uma frase-eixo " +
    "repetida, uma alusão bíblica específica, uma declaração sobre o caráter de Deus) — nunca elogios " +
    "genéricos. Classifique o gênero da canção como testemunho, redenção, restauração, esperança em Deus, " +
    "gratidão, confiança ou adoração; nunca como \"autoajuda\".",
  portugues:
    "Revise a letra em português palavra por palavra e frase por frase: ortografia, concordância, " +
    "regência, pontuação, clareza, coerência, consistência de pessoa verbal (1ª pessoa \"eu\" vs. 1ª " +
    "pessoa do plural \"nós\"), fluidez e prosódia. Liste em correcoes no máximo 6 problemas, priorizando " +
    "os mais importantes e graves — nunca mais que 6, mesmo que existam mais. Para CADA correção, cite o " +
    "trecho original exato (trechoOriginal), classifique o tipo e a gravidade, explique especificamente " +
    "por que está incorreto ou confuso em 1-2 frases curtas (nunca uma explicação vaga como \"pode " +
    "melhorar a fluidez\" ou \"a concordância precisa ser revista\"), e ofereça duas reescritas " +
    "alternativas curtas (opcao1, opcao2), indicando em observacaoDeSentido, em poucas palavras, se as " +
    "alternativas mudam o sentido original. Liste em problemasDeConsistencia qualquer alternância não " +
    "intencional entre primeira pessoa do singular e do plural, ou outras inconsistências narrativas. Em " +
    "prioridades, liste no máximo 5 correções mais importantes, em ordem, de forma direta e acionável. Em " +
    "pontosFortes, cite elementos concretos da letra, nunca elogios vagos.",
  composicao:
    "Analise a composição: estrutura, classificação lírica, emoção predominante, energia textual, tema " +
    "central, observações de produção, pontos fortes e sugestões. Nos pontos fortes, cite elementos " +
    "concretos da letra (por exemplo: progressão de uma emoção para outra, repetição de uma frase-eixo, " +
    "linguagem acessível) — nunca elogios genéricos. Nunca classifique a canção como \"autoajuda\"; " +
    "prefira testemunho, redenção, restauração, esperança em Deus, gratidão, confiança ou adoração.",
  congregacional:
    "Avalie o uso congregacional em frases curtas e objetivas (no máximo 2 frases por campo): adequação, " +
    "facilidade de canto, clareza da mensagem, pontos fortes e sugestões.",
};

// The português and congregacional schemas ask for the most string-heavy
// content (an array of rich correction objects, or several free-text
// evaluation fields) — the two areas most likely to run out of the retry's
// smaller token budget before finishing the JSON object. Their retry prompt
// asks for noticeably less than the primary attempt, on top of the generic
// "Seja breve." every other area gets, specifically to avoid a truncated
// (and therefore fully discarded) response on the very attempt that already
// has the least room to work with.
const AREA_FOCUS_RETRY_OVERRIDES: Partial<Record<Area, string>> = {
  portugues:
    "Revise a letra em português, de forma extremamente concisa. Liste em correcoes no máximo 3 " +
    "problemas mais importantes: trecho original, tipo, gravidade, uma explicação objetiva em 1 frase, e " +
    "duas opções de reescrita curtas. Nunca explicações vagas.",
  congregacional:
    "Avalie o uso congregacional de forma extremamente concisa: 1 frase por campo (adequação, facilidade " +
    "de canto, clareza da mensagem), no máximo 2 pontos fortes e 2 sugestões.",
};

export function areaUserPayload(area: Area, _request: AnalyzeRequest, sections: SongSection[]): string {
  return `${AREA_FOCUS[area]}

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>`;
}

export function areaRetryUserPayload(area: Area, sections: SongSection[]): string {
  const focus = AREA_FOCUS_RETRY_OVERRIDES[area] ?? `${AREA_FOCUS[area]} Seja breve.`;
  return `${focus}

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

// A correction is only useful if it says which passage, what's wrong, and
// why — reject anything that reads like generic feedback with nothing
// concrete to act on.
const VAGUE_EXPLANATION_PHRASES = ["pode melhorar", "precisa ser revist", "pode ficar mais clar"];

function isVagueExplanation(explicacao: string): boolean {
  const normalized = explicacao.trim().toLowerCase();
  if (normalized.length < 15) return true;
  return VAGUE_EXPLANATION_PHRASES.some((phrase) => normalized.includes(phrase));
}

// A model sometimes echoes the category label itself ("Temática", "Alusão",
// "Direta") back as if it were the actual relação-com-a-letra explanation —
// that reads to the user as a fabricated excerpt/explanation, since it isn't
// real content from the lyrics at all. Treated the same as no explanation.
const BIBLICAL_RELATION_LABEL_ECHOES = new Set(["direta", "alusao", "tematica", "citacao direta"]);

function isVagueBiblicalRelation(relacao: string): boolean {
  const normalized = relacao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.length < 15) return true;
  return BIBLICAL_RELATION_LABEL_ECHOES.has(normalized);
}

// This lyric (and others like it) is a testimony/redemption song, not
// self-help — if a model ever mislabels it that way, correct it rather
// than surface the label as-is.
const SELF_HELP_LABEL_PATTERN = /auto[\s-]?ajuda/gi;

function stripSelfHelpLabel(value: string): string {
  return value.replace(SELF_HELP_LABEL_PATTERN, "testemunho de fé").trim();
}

const PORTUGUES_TIPO_TO_GRAMMAR_TYPE: Record<string, z.infer<typeof GrammarFindingTypeSchema>> = {
  ortografia: "ortografia",
  concordancia: "concordancia_verbal",
  regencia: "regencia",
  pontuacao: "pontuacao",
  clareza: "ambiguidade",
  coerencia: "construcao_pouco_natural",
  pessoa_verbal: "consistencia_tempos_verbais",
  fluidez: "construcao_pouco_natural",
  prosodia: "palavra_dificil_de_cantar",
};

function mapPortuguesTipoToGrammarType(tipo: string): z.infer<typeof GrammarFindingTypeSchema> {
  return PORTUGUES_TIPO_TO_GRAMMAR_TYPE[tipo] ?? "construcao_pouco_natural";
}

function mapBiblicalReferences(
  items: BiblicalAIShape["referenciasBiblicas"],
  request: AnalyzeRequest
): BibleReference[] {
  return items
    .filter((item) => item.referencia && item.referencia.trim().length > 0)
    .map((item, i) => {
      const parsed = parseReferenceLabel(item.referencia);
      const hasUsableRelation = Boolean(item.relacaoComALetra) && !isVagueBiblicalRelation(item.relacaoComALetra);
      return {
        id: `ai-ref-${i}-${slugify(item.referencia)}`,
        excerptFromLyrics: hasUsableRelation ? item.relacaoComALetra : item.referencia,
        referenceLabel: item.referencia.trim(),
        book: parsed?.book ?? item.referencia.trim(),
        chapterStart: parsed?.chapterStart ?? 1,
        verseStart: parsed?.verseStart ?? 1,
        chapterEnd: parsed?.chapterEnd,
        verseEnd: parsed?.verseEnd,
        relationType: mapTipoToRelationType(item.tipo),
        proximity: proximityForTipo(item.tipo),
        explanation: hasUsableRelation
          ? item.relacaoComALetra
          : "A análise identificou esta referência, mas não forneceu uma explicação detalhada da relação com a letra nesta tentativa.",
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

  const messagePerceived = stripSelfHelpLabel(
    firstNonEmpty(biblical?.mensagemPercebida, composicao?.temaCentral) ??
      "Não foi possível determinar a mensagem central nesta análise."
  );

  const structureDisplay = stripSelfHelpLabel(
    composicao?.estrutura?.trim() ? normalizeDisplayValue(composicao.estrutura) : "Não determinado"
  );

  const perceivedFunctions = matchEnumOrFallback(
    composicao?.classificacaoLirica,
    SongFunctionSchema.options,
    ["reflexiva"]
  );

  const emotionDisplay = stripSelfHelpLabel(
    composicao?.emocao?.trim() ? normalizeDisplayValue(composicao.emocao) : "Não determinado"
  );
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
    .filter(
      (c) =>
        c.trechoOriginal &&
        c.trechoOriginal.trim().length > 0 &&
        !isVagueExplanation(c.explicacao)
    )
    .map((c, i) => {
      const finding: GrammarFinding = {
        id: `gram-${i}-${slugify(c.trechoOriginal)}`,
        originalExcerpt: c.trechoOriginal,
        type: mapPortuguesTipoToGrammarType(c.tipo),
        explanation: c.explicacao,
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "ia",
        severity: c.gravidade,
      };
      if (c.opcao1) finding.possibleCorrection = c.opcao1;
      if (c.opcao2) finding.alternativeCorrection = c.opcao2;
      if (c.observacaoDeSentido) finding.meaningChangeNote = c.observacaoDeSentido;
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
  ]).map(stripSelfHelpLabel);
  const strengths = strengthsUnion.length > 0 ? strengthsUnion : ["Não foi possível identificar pontos fortes nesta análise."];

  const topPriorities = (portugues?.prioridades ?? [])
    .filter((p) => p.trim().length > 0)
    .slice(0, 5)
    .map(stripSelfHelpLabel);
  const narrativeConsistencyIssues = dedupe(portugues?.problemasDeConsistencia ?? []).map(stripSelfHelpLabel);
  const portugueseSummary = firstNonEmpty(portugues?.resumo)
    ? stripSelfHelpLabel(firstNonEmpty(portugues?.resumo)!)
    : undefined;

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
    topPriorities,
    narrativeConsistencyIssues,
    portugueseSummary,
  };
}
