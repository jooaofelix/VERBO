import type { BibleReference } from "@verbo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectCuratedAllusions, enrichBibleReferences, lookupVerse, resolveUserProvidedReferences } from "./lookup.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("finds a verse via its singular 'salmo' alias even when queried with the plural 'Salmos' (common AI/user phrasing)", () => {
    const result = lookupVerse("Salmos 23");
    expect(result.found).toBe(true);
    expect(result.text).toContain("O Senhor é o meu pastor");
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
  it("fills in real verse text for a reference the AI identified correctly", async () => {
    const [enriched] = await enrichBibleReferences([ref({ referenceLabel: "João 3:16" })]);
    expect(enriched.verseTextAvailable).toBe(true);
    expect(enriched.verseText).toContain("amou o mundo");
  });

  it("promotes a reference to 'forte' (proximity alta, confidence high) when the lyric excerpt really shares vocabulary with the verse text", async () => {
    const [enriched] = await enrichBibleReferences([
      ref({
        referenceLabel: "João 3:16",
        excerptFromLyrics: "Deus amou o mundo de tal maneira",
        proximity: "baixa",
        confidence: "low",
      }),
    ]);
    expect(enriched.proximity).toBe("alta");
    expect(enriched.confidence).toBe("high");
  });

  it("keeps the AI's own (weaker) classification when the excerpt is only thematically related, not textually", async () => {
    const [enriched] = await enrichBibleReferences([
      ref({
        referenceLabel: "João 3:16",
        excerptFromLyrics: "Minha esperança está firmada em ti, meu Senhor",
        proximity: "baixa",
        confidence: "low",
      }),
    ]);
    expect(enriched.proximity).toBe("baixa");
    expect(enriched.confidence).toBe("low");
    expect(enriched.verseTextAvailable).toBe(true);
  });

  it("finds the curated text when the AI cites a specific verse that falls inside a curated range (e.g. Salmos 23:4 inside curated Salmos 23:1-4)", async () => {
    const [enriched] = await enrichBibleReferences([
      ref({ referenceLabel: "Salmos 23:4", book: "Salmos", chapterStart: 23, verseStart: 4 }),
    ]);
    expect(enriched.verseTextAvailable).toBe(true);
    expect(enriched.verseText).toContain("O Senhor é o meu pastor");
  });

  it("discards any AI-supplied verse text for a reference outside both the curated dataset and abibliadigital (no token configured)", async () => {
    const [enriched] = await enrichBibleReferences([
      ref({
        referenceLabel: "Levítico 19:34",
        book: "Levítico",
        chapterStart: 19,
        verseStart: 34,
        verseText: "texto inventado pela IA",
        verseTextAvailable: true,
      }),
    ]);
    expect(enriched.verseTextAvailable).toBe(false);
    expect(enriched.verseText).toBeUndefined();
  });

  it("falls back to abibliadigital for a reference outside the curated dataset when a token is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ text: "Amarás o teu próximo como a ti mesmo." }),
      }))
    );

    const [enriched] = await enrichBibleReferences(
      [ref({ referenceLabel: "Levítico 19:34", book: "Levítico", chapterStart: 19, verseStart: 34 })],
      "fake-token"
    );

    expect(enriched.verseTextAvailable).toBe(true);
    expect(enriched.verseText).toBe("Amarás o teu próximo como a ti mesmo.");
    expect(enriched.translationUsed).toContain("abibliadigital.com.br");
    expect(enriched.attribution).toMatch(/abibliadigital/i);
  });

  it("still reports verseTextAvailable=false when abibliadigital itself fails, even with a token configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );

    const [enriched] = await enrichBibleReferences(
      [ref({ referenceLabel: "Levítico 19:34", book: "Levítico", chapterStart: 19, verseStart: 34 })],
      "fake-token"
    );

    expect(enriched.verseTextAvailable).toBe(false);
    expect(enriched.verseText).toBeUndefined();
  });
});

describe("resolveUserProvidedReferences", () => {
  it("returns an empty list when the composer provided no base reference", async () => {
    expect(await resolveUserProvidedReferences([])).toEqual([]);
  });

  it("resolves a base reference against the curated dataset directly, by label", async () => {
    const [resolved] = await resolveUserProvidedReferences(["João 3:16"]);
    expect(resolved.label).toBe("João 3:16");
    expect(resolved.text).toContain("amou o mundo");
  });

  it("resolves a base reference by book/chapter/verse-in-range against a curated range (e.g. Salmos 23:4 inside curated Salmos 23:1-4)", async () => {
    const [resolved] = await resolveUserProvidedReferences(["Salmos 23:4"]);
    expect(resolved.text).toContain("O Senhor é o meu pastor");
  });

  it("falls back to abibliadigital for a reference outside the curated dataset when a token is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ text: "Amarás o teu próximo como a ti mesmo." }),
      }))
    );

    const [resolved] = await resolveUserProvidedReferences(["Levítico 19:34"], "fake-token");
    expect(resolved.text).toBe("Amarás o teu próximo como a ti mesmo.");
  });

  it("passes a reference through with no text (never a fabricated one) when it can't be resolved anywhere", async () => {
    const [resolved] = await resolveUserProvidedReferences(["Levítico 19:34"]);
    expect(resolved.label).toBe("Levítico 19:34");
    expect(resolved.text).toBeUndefined();
  });

  it("resolves several base references at once", async () => {
    const resolved = await resolveUserProvidedReferences(["João 3:16", "Salmos 23"]);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].text).toContain("amou o mundo");
    expect(resolved[1].text).toContain("O Senhor é o meu pastor");
  });
});
