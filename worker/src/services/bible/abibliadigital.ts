const ABIBLIADIGITAL_BASE = "https://www.abibliadigital.com.br/api";
const REQUEST_TIMEOUT_MS = 6000;
// "acf" (Almeida Corrigida Fiel) is the closest available translation to the
// historic public-domain Almeida text this app already uses for its curated
// dataset — kept consistent so attribution/wording style doesn't jump
// between a curated verse and one fetched live from this API.
const DEFAULT_VERSION = "acf";

// Standard Portuguese book abbreviations used by abibliadigital's API.
// Keyed by a normalized (lowercase, accent-stripped) full book name, with
// the common variants that show up in curated data and in the AI's own
// free-text reference labels (singular/plural, with/without numeral).
const BOOK_ABBREVIATIONS: Record<string, string> = {
  genesis: "gn",
  exodo: "ex",
  levitico: "lv",
  numeros: "nm",
  deuteronomio: "dt",
  josue: "js",
  juizes: "jz",
  rute: "rt",
  "1 samuel": "1sm",
  "2 samuel": "2sm",
  "1 reis": "1rs",
  "2 reis": "2rs",
  "1 cronicas": "1cr",
  "2 cronicas": "2cr",
  ezra: "ed",
  esdras: "ed",
  neemias: "ne",
  ester: "et",
  jo: "job",
  job: "job",
  salmo: "sl",
  salmos: "sl",
  proverbios: "pv",
  eclesiastes: "ec",
  cantares: "ct",
  "canticos de salomao": "ct",
  isaias: "is",
  jeremias: "jr",
  lamentacoes: "lm",
  ezequiel: "ez",
  daniel: "dn",
  oseias: "os",
  joel: "jl",
  amos: "am",
  obadias: "ob",
  jonas: "jn",
  miqueias: "mq",
  naum: "na",
  habacuque: "hc",
  sofonias: "sf",
  ageu: "ag",
  zacarias: "zc",
  malaquias: "ml",
  mateus: "mt",
  marcos: "mc",
  lucas: "lc",
  joao: "jo",
  atos: "at",
  romanos: "rm",
  "1 corintios": "1co",
  "2 corintios": "2co",
  galatas: "gl",
  efesios: "ef",
  filipenses: "fp",
  colossenses: "cl",
  "1 tessalonicenses": "1ts",
  "2 tessalonicenses": "2ts",
  "1 timoteo": "1tm",
  "2 timoteo": "2tm",
  tito: "tt",
  filemom: "fm",
  hebreus: "hb",
  tiago: "tg",
  "1 pedro": "1pe",
  "2 pedro": "2pe",
  "1 joao": "1jo",
  "2 joao": "2jo",
  "3 joao": "3jo",
  judas: "jd",
  apocalipse: "ap",
};

function normalizeBookName(book: string): string {
  return book
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^i\s+/, "1 ")
    .replace(/^ii\s+/, "2 ")
    .replace(/^iii\s+/, "3 ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolves a free-text Portuguese book name to abibliadigital's abbreviation, or null if unrecognized. */
export function resolveBookAbbreviation(book: string): string | null {
  return BOOK_ABBREVIATIONS[normalizeBookName(book)] ?? null;
}

export interface ExternalVerseResult {
  text: string;
  version: string;
}

/**
 * Fetches a single verse's text from the abibliadigital.com.br free API —
 * used only as a fallback when a reference isn't in this app's small
 * curated dataset. Requires a free API token (register at
 * abibliadigital.com.br and set it as the ABIBLIADIGITAL_TOKEN Worker
 * secret); when the token isn't configured, or the request fails for any
 * reason (network error, timeout, unrecognized book, non-2xx response,
 * unexpected shape), this returns null and the caller falls back to its
 * existing "verse text not available" behavior. Never fabricates text.
 */
export async function fetchExternalVerse(
  book: string,
  chapter: number,
  verse: number,
  token: string | undefined
): Promise<ExternalVerseResult | null> {
  if (!token) return null;

  const abbrev = resolveBookAbbreviation(book);
  if (!abbrev) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ABIBLIADIGITAL_BASE}/verses/${DEFAULT_VERSION}/${abbrev}/${chapter}/${verse}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.log("abibliadigital lookup failed", { status: response.status, book: abbrev, chapter, verse });
      return null;
    }

    const data = (await response.json()) as { text?: unknown };
    if (typeof data.text !== "string" || !data.text.trim()) return null;

    return { text: data.text.trim(), version: DEFAULT_VERSION };
  } catch (err) {
    console.log("abibliadigital lookup error", { message: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
