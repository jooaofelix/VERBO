import {
  BibleRelationTypeSchema,
  ConsistencyLevelSchema,
  GrammarFindingSchema,
  GrammarFindingTypeSchema,
  ProximitySchema,
  type AIProducedAnalysis,
  type AnalyzeRequest,
  type BibleReference,
  type ConfidenceLevel,
  type GrammarFinding,
  type RevisionMode,
  type SongSection,
} from "@verbo/shared";
import { z } from "zod";
import type { ResolvedUserReference } from "../services/bible/lookup.js";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * The two areas a "revisão completa" is broken into — every bit of AI depth
 * and token budget is concentrated here: biblical text/context review and
 * Portuguese-language review (spelling, grammar, agreement). Each maps 1:1
 * to a RevisionMode value, which is what an "individual mode" request
 * (revisionMode !== "rapida"/"completa") already names.
 */
export type Area = "biblica_teologica" | "portugues";

export const ALL_AREAS: Area[] = ["biblica_teologica", "portugues"];

export const AREA_LABELS: Record<Area, string> = {
  biblica_teologica: "bíblica e teológica",
  portugues: "português",
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
  /** Only filled when the composer provided base reference(s) — never guessed on its own. */
  consistenciaComReferenciaDoUsuario: ConsistencyLevelSchema.default("nao_foi_possivel_determinar"),
  explicacaoConsistenciaReferencia: z.string().default(""),
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

export type AreaAIShape = BiblicalAIShape | PortuguesAIShape;

export function areaAISchemaFor(area: Area): z.ZodObject<any> {
  switch (area) {
    case "biblica_teologica":
      return BiblicalAIShapeSchema;
    case "portugues":
      return PortuguesAIShapeSchema;
  }
}

/** All fields at their schema default — used both as the "nothing came back" fallback and as the per-field rescue source. */
export function areaEmptyShape(area: Area): AreaAIShape {
  return areaAISchemaFor(area).parse({}) as AreaAIShape;
}

const AREA_JSON_SCHEMAS: Record<Area, ReturnType<typeof zodToJsonSchema>> = {
  biblica_teologica: zodToJsonSchema(BiblicalAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
  portugues: zodToJsonSchema(PortuguesAIShapeSchema, { target: "openApi3", $refStrategy: "none" }),
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
    "Faça uma revisão bíblica de texto e de contexto. Identifique referências bíblicas prováveis (ex.: " +
    "\"Salmos 23:1\"), sua relação com a letra e o tipo (direta, alusão ou temática), explicando em pelo " +
    "menos uma frase específica por que a conexão faz sentido à luz do contexto da passagem — nunca uma " +
    "resposta de uma palavra só, como \"temática\" ou \"alusão\". Não procure apenas citações literais: " +
    "uma pergunta retórica ou uma frase reescrita com outras palavras que comunique a mesma ideia de um " +
    "versículo conhecido (ex.: \"quem poderá nos separar de ti?\" ecoando Romanos 8:35/38-39) também é " +
    "uma alusão real e deve ser identificada pelo sentido, não pela semelhança literal das palavras. " +
    "Nunca escreva o texto do versículo, apenas a referência. Acrescente observações teológicas e pontos " +
    "fortes citando elementos concretos da letra (uma frase-eixo repetida, uma alusão bíblica específica, " +
    "uma declaração sobre o caráter de Deus) — nunca elogios genéricos. Classifique o gênero da canção " +
    "como testemunho, redenção, restauração, esperança em Deus, gratidão, confiança ou adoração; nunca " +
    "como \"autoajuda\".",
  portugues:
    "Revise a letra em português palavra por palavra e frase por frase: ortografia, concordância, " +
    "regência, pontuação, clareza, coerência, consistência de pessoa verbal (1ª pessoa \"eu\" vs. 1ª " +
    "pessoa do plural \"nós\"), fluidez e prosódia. Liste em correcoes no máximo 8 problemas, priorizando " +
    "os mais importantes e graves. Para CADA correção, cite o trecho original exato (trechoOriginal), " +
    "classifique o tipo e a gravidade, explique especificamente por que está incorreto ou confuso em 1-2 " +
    "frases curtas (nunca uma explicação vaga como \"pode melhorar a fluidez\" ou \"a concordância precisa " +
    "ser revista\"), e ofereça duas reescritas alternativas curtas (opcao1, opcao2), indicando em " +
    "observacaoDeSentido, em poucas palavras, se as alternativas mudam o sentido original. Liste em " +
    "problemasDeConsistencia qualquer alternância não intencional entre primeira pessoa do singular e do " +
    "plural, ou outras inconsistências narrativas. Em prioridades, liste no máximo 5 correções mais " +
    "importantes, em ordem, de forma direta e acionável. Em pontosFortes, cite elementos concretos da " +
    "letra, nunca elogios vagos.",
};

// Português asks for the most string-heavy content (an array of rich
// correction objects) — the area most likely to run out of the retry's
// smaller token budget before finishing the JSON object. Its retry prompt
// asks for noticeably less than the primary attempt, on top of the generic
// "Seja breve." biblica_teologica gets, specifically to avoid a truncated
// (and therefore fully discarded) response on the very attempt that already
// has the least room to work with.
const AREA_FOCUS_RETRY_OVERRIDES: Partial<Record<Area, string>> = {
  portugues:
    "Revise a letra em português, de forma extremamente concisa. Liste em correcoes no máximo 3 " +
    "problemas mais importantes: trecho original, tipo, gravidade, uma explicação objetiva em 1 frase, e " +
    "duas opções de reescrita curtas. Nunca explicações vagas.",
};

// Gemini isn't bound by Cloudflare's per-request neuron/timeout budget the
// way the free Workers AI model is, so when it's the one answering — now the
// only two areas that exist, this is virtually always — it can afford to be
// asked for meaningfully more: more corrections, more references, longer
// per-item explanations. The Workers AI retry (if Gemini fails) always
// falls back to the terser AREA_FOCUS above, which is calibrated for that
// smaller model's real capacity. With composição and congregacional gone,
// every bit of this extra depth goes into these two areas.
const AREA_FOCUS_GEMINI_OVERRIDES: Partial<Record<Area, string>> = {
  portugues:
    "Revise a letra em português palavra por palavra e frase por frase, com profundidade real: ortografia, " +
    "concordância verbal e nominal, regência, pontuação, clareza, coerência, consistência de pessoa verbal " +
    "(1ª pessoa \"eu\" vs. 1ª pessoa do plural \"nós\"), fluidez e prosódia. Liste em correcoes até 12 " +
    "problemas reais — não invente problemas que não existem, mas também não deixe de citar um problema " +
    "real só para ser breve. Para CADA correção, cite o trecho original exato (trechoOriginal), classifique " +
    "o tipo e a gravidade, e explique em pelo menos duas frases específicas por que está incorreto ou " +
    "confuso — nunca uma frase genérica de uma linha como \"pode melhorar a fluidez\" ou \"a concordância " +
    "precisa ser revista\". Ofereça duas reescritas alternativas reais (opcao1, opcao2) que preservem o " +
    "estilo da letra, indicando em observacaoDeSentido, com uma frase, se mudam o sentido original. Liste " +
    "em problemasDeConsistencia toda alternância não intencional entre primeira pessoa do singular e do " +
    "plural, citando os trechos onde ocorre. Em prioridades, liste no máximo 5 correções mais importantes, " +
    "em ordem, de forma direta e acionável. Em pontosFortes, cite elementos concretos da letra (imagens, " +
    "repetições, progressão emocional), nunca elogios vagos.",
  biblica_teologica:
    "Faça uma revisão bíblica de texto e de contexto com toda a profundidade possível — esta é a área " +
    "central da análise. Identifique referências bíblicas prováveis (ex.: \"Salmos 23:1\"). Se a letra " +
    "permitir, identifique de 3 a 5 referências distintas, não apenas uma ou duas. Procure tanto citações " +
    "diretas quanto alusões pelo SENTIDO: uma pergunta retórica ou uma frase com outras palavras que " +
    "comunique a mesma ideia de um versículo conhecido também conta (ex.: \"quem poderá nos separar de " +
    "ti?\" ecoando Romanos 8:35/38-39, ou \"tu me sustentas\" ecoando Salmos 23) — nunca exija semelhança " +
    "literal de palavras para reconhecer uma alusão real. Para CADA referência, classifique o tipo (direta, " +
    "alusão ou temática) e escreva em relacaoComALetra pelo menos duas frases específicas: (1) qual trecho " +
    "ou imagem exata da letra remete a essa passagem, citando palavras da própria letra, e (2) por que essa " +
    "conexão faz sentido teologicamente à luz do contexto histórico e literário da passagem, não apenas da " +
    "frase isolada — nunca uma resposta de uma palavra só, como \"temática\" ou \"alusão\". Nunca escreva o " +
    "texto do versículo, apenas a referência. Acrescente pelo menos três observações teológicas específicas " +
    "(nunca genéricas) sobre como a letra dialoga com doutrinas ou temas bíblicos centrais, alertas quando " +
    "alguma afirmação da letra pareça teologicamente imprecisa ou carecer de contexto, e pontos fortes " +
    "citando elementos concretos da letra (uma frase-eixo repetida, uma alusão bíblica específica, uma " +
    "declaração sobre o caráter de Deus) — nunca elogios genéricos. Classifique o gênero da canção como " +
    "testemunho, redenção, restauração, esperança em Deus, gratidão, confiança ou adoração; nunca como " +
    "\"autoajuda\".",
};

// When the composer already had a base verse in mind (context.bibleReferencesProvidedByUser),
// the biblica_teologica area is asked to explicitly check whether the lyric's content really
// fits that passage's context — not just whether it name-drops similar words — and to report a
// real consistency verdict instead of the static "não avaliado" placeholder. The real verse text
// is resolved server-side (curated dataset, then abibliadigital.com.br — see
// resolveUserProvidedReferences) and handed to the model here, so it reasons against the actual
// passage instead of its own possibly-hallucinated memory of what a reference says.
function userProvidedReferencesInstructions(refs: ResolvedUserReference[], concise: boolean): string {
  if (refs.length === 0) return "";

  const plural = refs.length > 1;
  const list = refs
    .map((r) => (r.text ? `${r.label}: "${r.text}"` : `${r.label} (texto não disponível)`))
    .join("; ");

  if (concise) {
    return (
      `\n\nO compositor indicou ${plural ? "estas referências base" : "esta referência base"}, com o texto ` +
      `bíblico real entre aspas quando disponível: ${list}. Avalie, com base nesse texto (não em memória sua), ` +
      "se a letra faz sentido com o contexto dessa(s) passagem(ns) e preencha consistenciaComReferenciaDoUsuario " +
      "e explicacaoConsistenciaReferencia (1 frase objetiva)."
    );
  }

  return (
    `\n\nO compositor já tem em mente ${plural ? "estas referências bíblicas base" : "esta referência bíblica base"}, ` +
    `com o texto bíblico REAL (obtido de uma API, não de sua memória) entre aspas quando disponível: ${list}. Leia ` +
    "o contexto histórico e teológico desse texto — não apenas a frase isolada — e avalie se o conteúdo e a " +
    "mensagem da letra realmente fazem sentido com esse contexto, não apenas se usam palavras parecidas. Se o " +
    "texto não estiver disponível para alguma referência, avalie com cautela e não invente o conteúdo do " +
    "versículo. Preencha consistenciaComReferenciaDoUsuario com o nível real (muito_consistente, consistente, " +
    "parcialmente_consistente, precisa_revisao, ou nao_foi_possivel_determinar) e explique em " +
    "explicacaoConsistenciaReferencia, em pelo menos duas frases específicas — citando o texto bíblico e a letra " +
    "—, por que a letra combina ou não combina. Inclua também essa(s) referência(s) em referenciasBiblicas " +
    "normalmente."
  );
}

export function areaUserPayload(
  area: Area,
  sections: SongSection[],
  variant: "padrao" | "gemini" = "padrao",
  resolvedUserReferences: ResolvedUserReference[] = []
): string {
  const focus = variant === "gemini" ? (AREA_FOCUS_GEMINI_OVERRIDES[area] ?? AREA_FOCUS[area]) : AREA_FOCUS[area];
  const userVersesSuffix =
    area === "biblica_teologica" ? userProvidedReferencesInstructions(resolvedUserReferences, false) : "";
  return `${focus}${userVersesSuffix}

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>`;
}

export function areaRetryUserPayload(
  area: Area,
  sections: SongSection[],
  resolvedUserReferences: ResolvedUserReference[] = []
): string {
  const focus = AREA_FOCUS_RETRY_OVERRIDES[area] ?? `${AREA_FOCUS[area]} Seja breve.`;
  const userVersesSuffix =
    area === "biblica_teologica" ? userProvidedReferencesInstructions(resolvedUserReferences, true) : "";
  return `${focus}${userVersesSuffix}

<letra_do_usuario>
${formatSections(sections)}
</letra_do_usuario>`;
}

export const AREA_SYSTEM_PROMPT =
  "Você é revisor de letras musicais cristãs, especializado em revisão bíblica de texto e de contexto e " +
  "em revisão de português (ortografia, gramática e concordância). Nunca escreva o texto de um versículo " +
  "bíblico — apenas a referência. Não trate escolha artística como erro. Não avalie melodia, BPM ou " +
  "tonalidade, pois só o texto foi enviado. Preencha apenas os campos pedidos.";

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

function wordCountOf(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isVagueExplanation(explicacao: string): boolean {
  const normalized = explicacao.trim().toLowerCase();
  // A real explanation names what's wrong and why — a real sentence, not a
  // fragment. Both checks matter: a handful of long words isn't detailed
  // enough, and a long run of short filler words isn't either.
  if (normalized.length < 25 || wordCountOf(normalized) < 5) return true;
  return VAGUE_EXPLANATION_PHRASES.some((phrase) => normalized.includes(phrase));
}

// A model sometimes echoes the category label itself ("Temática", "Alusão",
// "Direta") back as if it were the actual relação-com-a-letra explanation —
// that reads to the user as a fabricated excerpt/explanation, since it isn't
// real content from the lyrics at all. Treated the same as no explanation.
const BIBLICAL_RELATION_LABEL_ECHOES = new Set(["direta", "alusao", "tematica", "citacao direta"]);

function isVagueBiblicalRelation(relacao: string): boolean {
  const trimmed = relacao.trim();
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (BIBLICAL_RELATION_LABEL_ECHOES.has(normalized)) return true;
  // A real rela\u00e7\u00e3o-com-a-letra explains, in at least a short sentence, what
  // in the lyric connects to the passage \u2014 not just a label or a fragment.
  return trimmed.length < 25 || wordCountOf(trimmed) < 5;
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
        explanationAvailable: hasUsableRelation,
        confidence: confidenceForTipo(item.tipo),
        translationUsed: request.bibleTranslationPreference,
        verseTextAvailable: false,
      };
    });
}

function toGeneralFindings(texts: string[], severity: "observation" | "attention", idPrefix: string) {
  return texts
    .filter((t) => t && t.trim().length > 0)
    .map((t, i) => ({
      id: `${idPrefix}-${i}`,
      category: "theological" as const,
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

  const messagePerceived = stripSelfHelpLabel(
    firstNonEmpty(biblical?.mensagemPercebida) ?? "Não foi possível determinar a mensagem central nesta análise."
  );

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

  const strengthsUnion = dedupe([...(biblical?.pontosFortes ?? []), ...(portugues?.pontosFortes ?? [])]).map(
    stripSelfHelpLabel
  );
  const strengths =
    strengthsUnion.length > 0 ? strengthsUnion : ["Não foi possível identificar pontos fortes nesta análise."];

  const topPriorities = (portugues?.prioridades ?? [])
    .filter((p) => p.trim().length > 0)
    .slice(0, 5)
    .map(stripSelfHelpLabel);
  const narrativeConsistencyIssues = dedupe(portugues?.problemasDeConsistencia ?? []).map(stripSelfHelpLabel);
  const portugueseSummary = firstNonEmpty(portugues?.resumo)
    ? stripSelfHelpLabel(firstNonEmpty(portugues?.resumo)!)
    : undefined;

  const findings = [
    ...toGeneralFindings(biblical?.observacoesTeologicas ?? [], "observation", "theo-obs"),
    ...toGeneralFindings(biblical?.alertas ?? [], "attention", "theo-alert"),
  ];

  const hasUserProvidedReferences = request.context.bibleReferencesProvidedByUser.length > 0;
  const consistencyWithStatedIntent =
    hasUserProvidedReferences && biblical?.consistenciaComReferenciaDoUsuario
      ? biblical.consistenciaComReferenciaDoUsuario
      : "nao_foi_possivel_determinar";
  const consistencyExplanation =
    hasUserProvidedReferences && !isVagueExplanation(biblical?.explicacaoConsistenciaReferencia ?? "")
      ? biblical!.explicacaoConsistenciaReferencia
      : hasUserProvidedReferences
        ? "Não foi possível avaliar de forma confiável a consistência com a(s) referência(s) informada(s) nesta análise."
        : "Consistência com a intenção declarada não é avaliada nesta versão da análise, pois nenhuma referência bíblica base foi informada.";

  return {
    overview: {
      perceivedCentralMessage: messagePerceived,
      likelyAudience: request.context.intendedAudience || "Não determinado",
      strengths,
      attentionPoints: dedupe(biblical?.alertas ?? []),
      consistencyWithStatedIntent,
      consistencyExplanation,
    },
    bibleReferences,
    biblicalContext: [],
    theologicalClaims: [],
    grammarFindings,
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
