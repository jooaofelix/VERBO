import type { BibleLookupResponse, BibleReference } from "@verbo/shared";
import { BIBLE_DATASET_DISCLAIMER, CURATED_VERSES, type CuratedVerse } from "./dataset.js";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
 * The AI is instructed never to output verse text, but this is the actual
 * safety net: whatever the model claims about `verseText`/`verseTextAvailable`
 * is discarded and replaced by a real lookup against the curated dataset.
 * A reference the model identified but that isn't in the dataset always ends
 * up with verseTextAvailable=false — never a fabricated quote.
 */
export function enrichBibleReferences(references: BibleReference[]): BibleReference[] {
  return references.map((ref) => {
    const lookup = lookupVerse(ref.referenceLabel);
    if (lookup.found) {
      return {
        ...ref,
        verseText: lookup.text,
        verseTextAvailable: true,
        translationUsed: lookup.translation ?? ref.translationUsed,
        attribution: lookup.attribution,
      };
    }
    return {
      ...ref,
      verseText: undefined,
      verseTextAvailable: false,
      attribution: undefined,
    };
  });
}
