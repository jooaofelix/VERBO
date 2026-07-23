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
    .trim();
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
      if (curated.found) {
        return {
          ...ref,
          verseText: curated.text,
          verseTextAvailable: true,
          translationUsed: curated.translation ?? ref.translationUsed,
          attribution: curated.attribution,
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
