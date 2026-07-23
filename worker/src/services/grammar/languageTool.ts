import type { GrammarFinding } from "@verbo/shared";

const LANGUAGETOOL_ENDPOINT = "https://api.languagetoolplus.com/v2/check";
const REQUEST_TIMEOUT_MS = 8000;
// The free public tier caps request size; keep well under it so checks on
// long lyrics never get rejected outright.
const MAX_TEXT_LENGTH = 15000;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `lt-${counter}`;
}

interface LanguageToolReplacement {
  value: string;
}

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements?: LanguageToolReplacement[];
  context: { text: string; offset: number; length: number };
  rule: {
    id: string;
    category?: { id: string; name: string };
  };
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

type GrammarFindingType = GrammarFinding["type"];

// LanguageTool's own rule categories, mapped onto our fixed taxonomy. Any
// category we don't recognize falls back to "construcao_pouco_natural"
// rather than being dropped — a real check still surfaced to the user.
const CATEGORY_TO_TYPE: Record<string, GrammarFindingType> = {
  TYPOS: "ortografia",
  MISSPELLING: "ortografia",
  CASING: "ortografia",
  PUNCTUATION: "pontuacao",
  TYPOGRAPHY: "pontuacao",
  GRAMMAR: "concordancia_verbal",
  AGREEMENT: "concordancia_nominal",
  CONFUSED_WORDS: "regencia",
  REDUNDANCY: "pleonasmo",
  STYLE: "construcao_pouco_natural",
  CLARITY: "ambiguidade",
  REPETITIONS: "repeticao_involuntaria",
  REPETITIONS_STYLE: "repeticao_involuntaria",
};

// Style/clarity-only categories are worth flagging but aren't hard errors —
// the phrasing may be an entirely intentional choice by the composer.
const STYLE_ONLY_CATEGORIES = new Set(["STYLE", "CLARITY", "REDUNDANCY", "REPETITIONS_STYLE"]);

function mapType(categoryId: string): GrammarFindingType {
  return CATEGORY_TO_TYPE[categoryId] ?? "construcao_pouco_natural";
}

function excerptFor(match: LanguageToolMatch): string {
  const { text, offset, length } = match.context;
  const excerpt = text.slice(offset, offset + length);
  return excerpt || text;
}

/**
 * Calls the free public LanguageTool API for a real rule-based grammar
 * check in Portuguese — a deterministic complement to the AI's own
 * "português" review, not a replacement for it. Always fails soft: on
 * timeout, a network error, a non-2xx response, or an unexpected response
 * shape, this returns an empty array so a slow/unavailable third-party
 * service never breaks the rest of the analysis.
 */
export async function runLanguageToolCheck(lyrics: string): Promise<GrammarFinding[]> {
  const text = lyrics.slice(0, MAX_TEXT_LENGTH).trim();
  if (!text) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(LANGUAGETOOL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "pt-BR" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.log("languagetool check failed", { status: response.status });
      return [];
    }

    const data = (await response.json()) as LanguageToolResponse;
    if (!Array.isArray(data.matches)) return [];

    return data.matches.map((match): GrammarFinding => {
      const categoryId = match.rule?.category?.id ?? "";
      const type = mapType(categoryId);
      const isStyleOnly = STYLE_ONLY_CATEGORIES.has(categoryId);
      const [first, second] = match.replacements ?? [];

      return {
        id: nextId(),
        originalExcerpt: excerptFor(match),
        type,
        explanation: match.message,
        possibleCorrection: first?.value,
        alternativeCorrection: second?.value,
        poeticLicensePossible: isStyleOnly,
        classification: isStyleOnly ? "escolha_estilistica" : "erro_provavel",
        source: "languagetool",
      };
    });
  } catch (err) {
    console.log("languagetool check error", { message: err instanceof Error ? err.message : String(err) });
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
