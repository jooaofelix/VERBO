import type { GrammarFinding, SongSection } from "@verbo/shared";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

// Common Portuguese pleonasms taught in style guides. Flagged as a
// stylistic observation, never as a hard grammatical error — poets use
// these for emphasis on purpose all the time.
const PLEONASMS = [
  "subir para cima",
  "descer para baixo",
  "entrar para dentro",
  "sair para fora",
  "vi com meus próprios olhos",
  "elo de ligação",
  "certeza absoluta",
  "monopólio exclusivo",
  "há anos atrás",
  "detalhes minuciosos",
  "surpresa inesperada",
  "encarar de frente",
  "retornar de novo",
  "repetir de novo",
];

// A short, non-exhaustive list of classic Portuguese cacophony
// (concatenation of two words that reads/sounds like an unrelated word).
// Deliberately conservative: only flags well-known textbook cases.
const CACOPHONY_BLACKLIST = [
  "porcada",
  "mafia",
  "cadavez",
  "camisinha",
  "boiada",
];

function wordCount(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length;
}

function findAll(text: string, regex: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(regex));
}

/**
 * Rule-based checks that don't need language understanding: spacing,
 * duplicated words, duplicated punctuation, very long lines, and a small
 * curated dictionary of pleonasms/cacophony candidates. These are
 * objective pattern matches — always cited with the exact excerpt — kept
 * separate from the AI's grammar findings (which handle concordância,
 * regência, conjugação, i.e. things that need real language understanding).
 */
export function runDeterministicChecks(sections: SongSection[]): GrammarFinding[] {
  const findings: GrammarFinding[] = [];

  for (const section of sections) {
    const lines = section.text.split("\n");

    // Double spaces
    findAll(section.text, /\S {2,}\S/g).forEach((m) => {
      findings.push({
        id: nextId("det"),
        sectionId: section.id,
        originalExcerpt: m[0],
        type: "pontuacao",
        explanation: "Há mais de um espaço entre palavras.",
        possibleCorrection: m[0].replace(/\s{2,}/g, " "),
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "deterministico",
      });
    });

    // Missing space after sentence punctuation followed by a letter
    findAll(section.text, /[.,;:!?][A-Za-zÀ-ÿ]/g).forEach((m) => {
      findings.push({
        id: nextId("det"),
        sectionId: section.id,
        originalExcerpt: m[0],
        type: "pontuacao",
        explanation: "Falta um espaço depois da pontuação.",
        possibleCorrection: `${m[0][0]} ${m[0].slice(1)}`,
        poeticLicensePossible: false,
        classification: "erro_provavel",
        source: "deterministico",
      });
    });

    // Repeated punctuation (!!, ??, ..) — often intentional emphasis
    findAll(section.text, /([!?.,])\1{1,}/g).forEach((m) => {
      findings.push({
        id: nextId("det"),
        sectionId: section.id,
        originalExcerpt: m[0],
        type: "pontuacao",
        explanation: "Pontuação repetida. Pode ser intencional para dar ênfase.",
        poeticLicensePossible: true,
        classification: "escolha_estilistica",
        source: "deterministico",
      });
    });

    lines.forEach((line) => {
      if (!line.trim()) return;

      // Immediately adjacent repeated word ("que que", "a a")
      findAll(line, /\b(\p{L}+)\s+\1\b/giu).forEach((m) => {
        findings.push({
          id: nextId("det"),
          sectionId: section.id,
          originalExcerpt: m[0],
          type: "repeticao_involuntaria",
          explanation: `A palavra "${m[1]}" aparece repetida em sequência.`,
          possibleCorrection: m[1],
          poeticLicensePossible: true,
          classification: "erro_provavel",
          source: "deterministico",
        });
      });

      // Overly long lines (rough proxy for hard-to-sing phrases)
      const words = wordCount(line);
      if (words >= 14) {
        findings.push({
          id: nextId("det"),
          sectionId: section.id,
          originalExcerpt: line.trim(),
          type: "frase_longa",
          explanation: `A linha tem aproximadamente ${words} palavras, o que pode dificultar o canto e a memorização.`,
          poeticLicensePossible: true,
          classification: "nao_determinado_sem_melodia",
          source: "deterministico",
        });
      }

      const lowerLine = line.toLowerCase();
      for (const pleonasm of PLEONASMS) {
        if (lowerLine.includes(pleonasm)) {
          findings.push({
            id: nextId("det"),
            sectionId: section.id,
            originalExcerpt: pleonasm,
            type: "pleonasmo",
            explanation: `"${pleonasm}" repete uma ideia já contida na própria expressão. Pode ser um pleonasmo vicioso ou um reforço poético intencional.`,
            poeticLicensePossible: true,
            classification: "escolha_estilistica",
            source: "deterministico",
          });
        }
      }

      const normalizedForCacophony = lowerLine.replace(/[^\p{L}\s]/gu, "");
      const wordsInLine = normalizedForCacophony.split(/\s+/).filter(Boolean);
      for (let i = 0; i < wordsInLine.length - 1; i++) {
        const joined = wordsInLine[i] + wordsInLine[i + 1];
        if (CACOPHONY_BLACKLIST.includes(joined)) {
          findings.push({
            id: nextId("det"),
            sectionId: section.id,
            originalExcerpt: `${wordsInLine[i]} ${wordsInLine[i + 1]}`,
            type: "cacofonia",
            explanation: `A junção de "${wordsInLine[i]}" com "${wordsInLine[i + 1]}" pode soar, ao ser cantada, como uma palavra diferente e indesejada.`,
            poeticLicensePossible: false,
            classification: "erro_provavel",
            source: "deterministico",
          });
        }
      }
    });
  }

  return findings;
}
