import type { BibleReference } from "@verbo/shared";
import { describe, expect, it } from "vitest";
import { detectCuratedAllusions, enrichBibleReferences, lookupVerse } from "./lookup.js";

function ref(overrides: Partial<BibleReference>): BibleReference {
  return {
    id: "ref-1",
    excerptFromLyrics: "trecho",
    referenceLabel: "João 3:16",
    book: "João",
    chapterStart: 3,
    verseStart: 16,
    relationType: "parafrase",
    proximity: "alta",
    explanation: "explicação",
    confidence: "medium",
    translationUsed: "desconhecida",
    verseTextAvailable: false,
    ...overrides,
  };
}

describe("lookupVerse", () => {
  it("finds a verse by its canonical reference label", () => {
    const result = lookupVerse("João 3:16");
    expect(result.found).toBe(true);
    expect(result.text).toContain("amou o mundo");
    expect(result.attribution).toMatch(/domínio público/i);
  });

  it("finds a verse by a common alias/abbreviation", () => {
    const result = lookupVerse("jo 3:16");
    expect(result.found).toBe(true);
  });

  it("is case- and accent-insensitive", () => {
    const result = lookupVerse("SALMOS 84:1-2");
    expect(result.found).toBe(true);
  });

  it("never fabricates text for a reference outside the curated dataset", () => {
    const result = lookupVerse("Levítico 19:34");
    expect(result.found).toBe(false);
    expect(result.text).toBeUndefined();
    expect(result.note).toBeTruthy();
  });
});

describe("detectCuratedAllusions", () => {
  it("identifies Salmo 126:5 from the exact example phrase, independent of the AI", () => {
    const lyrics = "Aqueles que semeiam com lágrimas colherão com a alegria do Senhor";
    const [found] = detectCuratedAllusions(lyrics);
    expect(found).toBeDefined();
    expect(found.referenceLabel).toBe("Salmos 126:5");
    expect(found.relationType).toBe("alusao");
    expect(found.proximity).toBe("alta");
    expect(found.confidence).toBe("high");
    expect(found.excerptFromLyrics.toLowerCase()).toContain("semeiam");
  });

  it("also matches the alternate 'os que semeiam' phrasing", () => {
    const lyrics = "Verso 1\nOs que semeiam com lágrimas colherão com alegria\n";
    const [found] = detectCuratedAllusions(lyrics);
    expect(found?.referenceLabel).toBe("Salmos 126:5");
  });

  it("is accent- and case-insensitive", () => {
    const lyrics = "AQUELES QUE SEMEIAM COM LAGRIMAS COLHERAO COM ALEGRIA";
    const [found] = detectCuratedAllusions(lyrics);
    expect(found?.referenceLabel).toBe("Salmos 126:5");
  });

  it("returns nothing when no curated phrase is present", () => {
    expect(detectCuratedAllusions("Uma letra qualquer sem nenhuma alusão bíblica conhecida.")).toEqual([]);
  });

  it("does not return duplicate entries for the same verse", () => {
    const lyrics =
      "Os que semeiam com lágrimas colherão com alegria\n\n" +
      "Aqueles que semeiam com lágrimas colherão com a alegria";
    const found = detectCuratedAllusions(lyrics);
    expect(found).toHaveLength(1);
  });
});

describe("enrichBibleReferences", () => {
  it("fills in real verse text for a reference the AI identified correctly", () => {
    const [enriched] = enrichBibleReferences([ref({ referenceLabel: "João 3:16" })]);
    expect(enriched.verseTextAvailable).toBe(true);
    expect(enriched.verseText).toContain("amou o mundo");
  });

  it("discards any AI-supplied verse text for references outside the curated dataset", () => {
    const [enriched] = enrichBibleReferences([
      ref({ referenceLabel: "Levítico 19:34", verseText: "texto inventado pela IA", verseTextAvailable: true }),
    ]);
    expect(enriched.verseTextAvailable).toBe(false);
    expect(enriched.verseText).toBeUndefined();
  });
});
