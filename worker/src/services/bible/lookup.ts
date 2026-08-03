import type { BibleLookupResponse, BibleReference } from "@verbo/shared";
import { fetchExternalVerse } from "./abibliadigital.js";
import { BIBLE_DATASET_DISCLAIMER, CURATED_VERSES, type CuratedVerse } from "./dataset.js";

const EXTERNAL_ATTRIBUTION =
  "Texto obtido via abibliadigital.com.br (tradução Almeida Corrigida Fiel, domínio público). " +
  "Confirme a citação exata em uma Bíblia impressa ou aplicativo oficial antes de publicar ou citar formalmente.";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bsalmos\b/g, "salmo"); // "Salmos 23" (plural, common AI/user phrasing) must match a "salmo 23" alias.
}

const ALLUSION_INDEX: Array<{ verse: CuratedVerse; normalizedPhrases: string[] }> = CURATED_VERSES.filter(
  (v) => v.allusionPhrases && v.allusionPhrases.length > 0
).map((verse) => ({
  verse,
  normalizedPhrases: (verse.allusionPhrases ?? []).map(normalize),
}));

function findOriginalExcerpt(lyrics: string, phrase: string): string | null {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = lyrics.match(new RegExp(escaped, "i"));
  return match ? match[0] : null;
}

const INDEX = new Map<string, CuratedVerse>();
for (const verse of CURATED_VERSES) {
  INDEX.set(normalize(verse.referenceLabel), verse);
  for (const alias of verse.aliases) {
    INDEX.set(normalize(alias), verse);
  }
}

/**
 * Looks up a reference in the small curated dataset. Never invents verse
 * text: if the reference isn't in the dataset, callers get found=false and
 * should fall back to showing only the reference + AI explanation.
 */
export function lookupVerse(query: string): BibleLookupResponse {
  const key = normalize(query);
  const verse = INDEX.get(key);

  if (!verse) {
    return {
      found: false,
      referenceLabel: query,
      note:
        "Não encontrei o texto desta referência no conjunto restrito de versículos disponível " +
        "nesta versão de demonstração. A referência e a explicação continuam disponíveis; " +
        "consulte o texto completo em uma Bíblia impressa ou aplicativo oficial.",
    };
  }

  return {
    found: true,
    referenceLabel: verse.referenceLabel,
    text: verse.text,
    translation: "Domínio público (base histórica Almeida)",
    attribution: BIBLE_DATASET_DISCLAIMER,
  };
}

export function listAvailableReferences(): string[] {
  return CURATED_VERSES.map((v) => v.referenceLabel);
}

/**
 * A reference like "Salmos 23:4" won't exact-match a curated "Salmos
 * 23:1-4" entry by label/alias, even though verse 4 is literally inside
 * that curated range — this checks book + chapter + whether the cited
 * verse falls within the curated range, so a slightly different verse
 * number the AI cites still surfaces the real text instead of "não
 * disponível" for a passage we already have.
 */
function findCuratedByRange(book: string, chapterStart: number, verseStart: number): CuratedVerse | null {
  const normalizedBook = normalize(book);
  for (const verse of CURATED_VERSES) {
    if (normalize(verse.book) !== normalizedBook) continue;
    if (verse.chapterStart !== chapterStart) continue;
    const rangeEnd = verse.verseEnd ?? verse.verseStart;
    if (verseStart >= verse.verseStart && verseStart <= rangeEnd) return verse;
  }
  return null;
}

/**
 * Scans the raw lyrics for a small set of curated, very-well-known
 * allusion phrasings (e.g. "os que semeiam com lágrimas colherão com
 * alegria" → Salmos 126:5) and returns a BibleReference for each match —
 * entirely independent of what the AI itself identified, so a well-known
 * allusion is never missed just because a small model's biblical-area call
 * failed, timed out, or simply didn't catch it.
 */
export function detectCuratedAllusions(lyrics: string): BibleReference[] {
  const normalizedLyrics = normalize(lyrics);
  const found: BibleReference[] = [];
  const seenReferenceLabels = new Set<string>();

  for (const { verse, normalizedPhrases } of ALLUSION_INDEX) {
    if (seenReferenceLabels.has(verse.referenceLabel)) continue;
    const matchedPhrase = verse.allusionPhrases?.find((phrase, i) =>
      normalizedLyrics.includes(normalizedPhrases[i])
    );
    if (!matchedPhrase) continue;

    seenReferenceLabels.add(verse.referenceLabel);
    found.push({
      id: `curated-allusion-${normalize(verse.referenceLabel).replace(/\s+/g, "-")}`,
      excerptFromLyrics: findOriginalExcerpt(lyrics, matchedPhrase) ?? matchedPhrase,
      referenceLabel: verse.referenceLabel,
      book: verse.book,
      chapterStart: verse.chapterStart,
      verseStart: verse.verseStart,
      chapterEnd: verse.chapterEnd,
      verseEnd: verse.verseEnd,
      relationType: "alusao",
      proximity: "alta",
      explanation:
        "Frase da letra corresponde a uma alusão bem conhecida a este versículo, reconhecida " +
        "automaticamente por um conjunto curado, independente do que o modelo de IA identificou.",
      confidence: "high",
      translationUsed: "dominio_publico_almeida",
      verseTextAvailable: false,
    });
  }

  return found;
}

// A handful of very common Portuguese function words that would otherwise
// dominate a naive word-overlap check without indicating any real match.
const OVERLAP_STOP_WORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "que", "um", "uma", "uns", "umas",
  "para", "com", "por", "se", "na", "no", "nas", "nos", "ao", "aos", "foi", "sao", "seu", "sua", "seus",
  "suas", "meu", "minha", "meus", "minhas", "teu", "tua", "nosso", "nossa", "ja", "ha", "mas", "ou",
  "nao", "sim", "eu", "tu", "ele", "ela", "voces", "te", "me", "lhe", "esta", "este", "isso", "isto",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !OVERLAP_STOP_WORDS.has(w))
  );
}

/**
 * A genuinely strong reference shares real vocabulary with the verse, not
 * just a theme guessed by the AI — this is what turns "a IA achou que
 * combina" into "o texto realmente bate", which is the distinction the
 * user asked for between a strong reference and a thematic one.
 */
function hasStrongTextualOverlap(excerpt: string, verseText: string): boolean {
  const excerptWords = significantWords(excerpt);
  if (excerptWords.size === 0) return false;
  const verseWords = significantWords(verseText);
  let shared = 0;
  for (const word of excerptWords) {
    if (verseWords.has(word)) shared++;
  }
  return shared >= 2 || shared / excerptWords.size >= 0.5;
}

/**
 * When the lyric excerpt the AI cited actually shares real vocabulary with
 * the verse text we just found, the reference is promoted to "alta"/"high"
 * — a verified textual match, not a thematic guess. When it doesn't (or the
 * text isn't available at all), the AI's own classification is left as-is.
 */
function withOverlapBoost(ref: BibleReference, verseText: string): Partial<BibleReference> {
  if (!hasStrongTextualOverlap(ref.excerptFromLyrics, verseText)) return {};
  return { proximity: "alta", confidence: "high" };
}

/**
 * Minimal, local duplicate of the free-text reference parsing the AI-facing
 * code does (book/chapter/verse from a string like "Romanos 8:28") — kept
 * separate so this bible-lookup module has no dependency on the providers
 * layer.
 */
function parseFreeTextReference(label: string): { book: string; chapterStart: number; verseStart: number } | null {
  const trimmed = label.trim();
  const match = trimmed.match(/^([1-3]?\s?[A-Za-zÀ-ÿ.]+(?:\s[A-Za-zÀ-ÿ.]+)*?)\s+(\d+)(?::(\d+))?/);
  if (!match) return null;
  const [, book, chapter, verse] = match;
  return { book: book.trim(), chapterStart: Number(chapter), verseStart: verse ? Number(verse) : 1 };
}

export interface ResolvedUserReference {
  label: string;
  text?: string;
  attribution?: string;
}

/**
 * Resolves each base verse the composer typed in directly against real
 * scripture text (curated dataset first, then abibliadigital.com.br) so the
 * AI evaluates historical context and lyric-fit against the actual passage —
 * never against its own possibly-hallucinated memory of what a reference
 * says. A reference that can't be resolved anywhere is passed through with
 * no text, never a fabricated one.
 */
export async function resolveUserProvidedReferences(
  refs: string[],
  abibliadigitalToken?: string
): Promise<ResolvedUserReference[]> {
  const trimmed = refs.map((r) => r.trim()).filter(Boolean);

  return Promise.all(
    trimmed.map(async (label): Promise<ResolvedUserReference> => {
      const curated = lookupVerse(label);
      if (curated.found && curated.text) {
        return { label: curated.referenceLabel, text: curated.text, attribution: curated.attribution };
      }

      const parsed = parseFreeTextReference(label);
      if (!parsed) return { label };

      const byRange = findCuratedByRange(parsed.book, parsed.chapterStart, parsed.verseStart);
      if (byRange) {
        return { label, text: byRange.text, attribution: BIBLE_DATASET_DISCLAIMER };
      }

      const external = await fetchExternalVerse(parsed.book, parsed.chapterStart, parsed.verseStart, abibliadigitalToken);
      if (external) {
        return { label, text: external.text, attribution: EXTERNAL_ATTRIBUTION };
      }

      return { label };
    })
  );
}

/**
 * The AI is instructed never to output verse text, but this is the actual
 * safety net: whatever the model claims about `verseText`/`verseTextAvailable`
 * is discarded and replaced by a real lookup — first against the small
 * curated dataset, then (only if not found there, and only when a token is
 * configured) against the abibliadigital.com.br free API using the
 * reference's own book/chapter/verse fields. A reference that isn't found in
 * either source always ends up with verseTextAvailable=false — never a
 * fabricated quote.
 */
export async function enrichBibleReferences(
  references: BibleReference[],
  abibliadigitalToken?: string
): Promise<BibleReference[]> {
  return Promise.all(
    references.map(async (ref) => {
      const curated = lookupVerse(ref.referenceLabel);
      if (curated.found && curated.text) {
        return {
          ...ref,
          verseText: curated.text,
          verseTextAvailable: true,
          translationUsed: curated.translation ?? ref.translationUsed,
          attribution: curated.attribution,
          ...withOverlapBoost(ref, curated.text),
        };
      }

      const curatedByRange = findCuratedByRange(ref.book, ref.chapterStart, ref.verseStart);
      if (curatedByRange) {
        return {
          ...ref,
          verseText: curatedByRange.text,
          verseTextAvailable: true,
          translationUsed: "Domínio público (base histórica Almeida)",
          attribution: BIBLE_DATASET_DISCLAIMER,
          ...withOverlapBoost(ref, curatedByRange.text),
        };
      }

      const external = await fetchExternalVerse(ref.book, ref.chapterStart, ref.verseStart, abibliadigitalToken);
      if (external) {
        return {
          ...ref,
          verseText: external.text,
          verseTextAvailable: true,
          translationUsed: `abibliadigital.com.br (${external.version.toUpperCase()})`,
          attribution: EXTERNAL_ATTRIBUTION,
          ...withOverlapBoost(ref, external.text),
        };
      }

      return {
        ...ref,
        verseText: undefined,
        verseTextAvailable: false,
        attribution: undefined,
      };
    })
  );
}
