import type { ProsodyFinding, SongSection } from "@verbo/shared";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `prosody-${counter}`;
}

const VOWELS = "aeiouáéíóúâêîôûãõàAEIOUÁÉÍÓÚÂÊÎÔÛÃÕÀ";

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch);
}

function tokenizeWords(line: string): string[] {
  return line
    .normalize("NFC")
    .split(/[^\p{L}'çÇ]+/u)
    .filter(Boolean);
}

/** Rough vowel-group count for a single word — a text-only proxy for syllables. */
function vowelGroupCount(word: string): number {
  let groups = 0;
  let inGroup = false;
  for (const ch of word) {
    if (isVowel(ch)) {
      if (!inGroup) {
        groups += 1;
        inGroup = true;
      }
    } else {
      inGroup = false;
    }
  }
  return Math.max(groups, 1);
}

function endsWithVowel(word: string): boolean {
  const last = word.at(-1);
  return !!last && isVowel(last);
}

function startsWithVowel(word: string): boolean {
  const first = word.at(0);
  return !!first && isVowel(first);
}

function findConsonantClusters(word: string): string[] {
  const clusters = word.match(/[^aeiouáéíóúâêîôûãõàAEIOUÁÉÍÓÚÂÊÎÔÛÃÕÀ]{3,}/g);
  return clusters ?? [];
}

function findVowelSequences(word: string): string[] {
  const sequences = word.match(/[aeiouáéíóúâêîôûãõàAEIOUÁÉÍÓÚÂÊÎÔÛÃÕÀ]{3,}/g);
  return sequences ?? [];
}

function classifyLength(count: number): "curta" | "media" | "longa" {
  if (count <= 5) return "curta";
  if (count <= 9) return "media";
  return "longa";
}

/**
 * Estimates poetic syllable count per line using vowel-group counting with
 * synalepha (vowel elision across word boundaries), the standard rough
 * approximation for Portuguese metrificação. This is always a text-only
 * estimate — real prosody depends on melody, which this function never sees.
 */
export function analyzeProsody(sections: SongSection[]): ProsodyFinding[] {
  const findings: ProsodyFinding[] = [];

  for (const section of sections) {
    const lines = section.text.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const words = tokenizeWords(line);
      if (words.length === 0) continue;

      const rawSyllables = words.reduce((sum, w) => sum + vowelGroupCount(w), 0);
      let elisions = 0;
      for (let i = 0; i < words.length - 1; i++) {
        if (endsWithVowel(words[i]) && startsWithVowel(words[i + 1])) {
          elisions += 1;
        }
      }
      const approxSyllableCount = Math.max(rawSyllables - elisions, 1);

      const clusters = words.flatMap(findConsonantClusters);
      const vowelSeqs = words.flatMap(findVowelSequences);

      const notes: string[] = [];
      if (clusters.length > 0) {
        notes.push(
          `Encontros consonantais como "${clusters[0]}" podem exigir mais cuidado na articulação em andamentos rápidos.`
        );
      }
      if (vowelSeqs.length > 0) {
        notes.push(
          `A sequência vocálica em "${vowelSeqs[0]}" pode se comportar de formas diferentes dependendo da melodia (uma sílaba só ou separada).`
        );
      }
      if (approxSyllableCount >= 13) {
        notes.push("Linha relativamente longa: pode exigir andamento mais rápido ou frase melódica mais longa.");
      }
      if (notes.length === 0) {
        notes.push("Sem observações métricas relevantes nesta linha.");
      }

      findings.push({
        id: nextId(),
        sectionId: section.id,
        lineText: line,
        approxSyllableCount,
        lineLengthClass: classifyLength(approxSyllableCount),
        difficultConsonantClusters: Array.from(new Set(clusters)),
        vowelSequences: Array.from(new Set(vowelSeqs)),
        fluencyNote: notes.join(" "),
      });
    }
  }

  return findings;
}
