/**
 * Gemini/Workers AI is instructed to write book names in Portuguese, but
 * doesn't always do it — especially for less common books, it sometimes
 * falls back to the English name (e.g. "Romans" instead of "Romanos").
 * When that happens, every downstream lookup (curated dataset,
 * abibliadigital.com.br) would otherwise fail purely because of the
 * language mismatch, even though the reference itself is perfectly valid.
 * This translates a handful of common English book names to Portuguese
 * before any of those lookups run; a book name that already looks
 * Portuguese (or isn't recognized at all) is returned unchanged.
 */
function normalizeKey(book: string): string {
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

const ENGLISH_TO_PORTUGUESE_BOOK: Record<string, string> = {
  genesis: "genesis",
  exodus: "exodo",
  leviticus: "levitico",
  numbers: "numeros",
  deuteronomy: "deuteronomio",
  joshua: "josue",
  judges: "juizes",
  ruth: "rute",
  "1 samuel": "1 samuel",
  "2 samuel": "2 samuel",
  "1 kings": "1 reis",
  "2 kings": "2 reis",
  "1 chronicles": "1 cronicas",
  "2 chronicles": "2 cronicas",
  ezra: "esdras",
  nehemiah: "neemias",
  esther: "ester",
  job: "jo",
  psalms: "salmos",
  psalm: "salmo",
  proverbs: "proverbios",
  ecclesiastes: "eclesiastes",
  "song of solomon": "cantares",
  "song of songs": "cantares",
  isaiah: "isaias",
  jeremiah: "jeremias",
  lamentations: "lamentacoes",
  ezekiel: "ezequiel",
  daniel: "daniel",
  hosea: "oseias",
  joel: "joel",
  amos: "amos",
  obadiah: "obadias",
  jonah: "jonas",
  micah: "miqueias",
  nahum: "naum",
  habakkuk: "habacuque",
  zephaniah: "sofonias",
  haggai: "ageu",
  zechariah: "zacarias",
  malachi: "malaquias",
  matthew: "mateus",
  mark: "marcos",
  luke: "lucas",
  john: "joao",
  acts: "atos",
  romans: "romanos",
  "1 corinthians": "1 corintios",
  "2 corinthians": "2 corintios",
  galatians: "galatas",
  ephesians: "efesios",
  philippians: "filipenses",
  colossians: "colossenses",
  "1 thessalonians": "1 tessalonicenses",
  "2 thessalonians": "2 tessalonicenses",
  "1 timothy": "1 timoteo",
  "2 timothy": "2 timoteo",
  titus: "tito",
  philemon: "filemom",
  hebrews: "hebreus",
  james: "tiago",
  "1 peter": "1 pedro",
  "2 peter": "2 pedro",
  "1 john": "1 joao",
  "2 john": "2 joao",
  "3 john": "3 joao",
  jude: "judas",
  revelation: "apocalipse",
};

export function translateBookNameToPortuguese(book: string): string {
  return ENGLISH_TO_PORTUGUESE_BOOK[normalizeKey(book)] ?? book;
}
