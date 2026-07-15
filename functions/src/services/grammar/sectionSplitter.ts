import type { SongSection } from "@verbo/shared";

const LABEL_PATTERNS: Array<{ type: SongSection["type"]; pattern: RegExp }> = [
  { type: "introducao", pattern: /^\s*(intro(du[cç][aã]o)?)\s*:?\s*$/i },
  { type: "pre_refrao", pattern: /^\s*pr[ée][- ]?ref(r[aã]o)?\s*:?\s*$/i },
  { type: "pos_refrao", pattern: /^\s*p[oó]s[- ]?ref(r[aã]o)?\s*:?\s*$/i },
  { type: "refrao", pattern: /^\s*(refr[aã]o|coro|chorus)\s*(\d+)?\s*:?\s*$/i },
  { type: "ponte", pattern: /^\s*(ponte|bridge)\s*:?\s*$/i },
  { type: "interludio", pattern: /^\s*interl[uú]dio\s*:?\s*$/i },
  { type: "final", pattern: /^\s*(final|encerramento|outro|coda)\s*:?\s*$/i },
  { type: "fala", pattern: /^\s*(fala|minist[rã]a[cç][aã]o|spoken)\s*:?\s*$/i },
  { type: "verso", pattern: /^\s*verso\s*(\d+)?\s*:?\s*$/i },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawBlock {
  lines: string[];
  startLine: number;
  endLine: number;
}

function splitIntoBlocks(lyrics: string): RawBlock[] {
  const allLines = lyrics.split("\n");
  const blocks: RawBlock[] = [];
  let current: string[] = [];
  let blockStart = 0;

  allLines.forEach((line, idx) => {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push({ lines: current, startLine: blockStart, endLine: idx - 1 });
        current = [];
      }
      blockStart = idx + 1;
    } else {
      if (current.length === 0) blockStart = idx;
      current.push(line);
    }
  });
  if (current.length > 0) {
    blocks.push({
      lines: current,
      startLine: blockStart,
      endLine: allLines.length - 1,
    });
  }
  return blocks;
}

function detectExplicitLabel(
  block: RawBlock
): { type: SongSection["type"]; index?: number } | null {
  const firstLine = block.lines[0];
  for (const { type, pattern } of LABEL_PATTERNS) {
    const match = firstLine.match(pattern);
    if (match) {
      const index = match[2] ? Number(match[2]) : match[1] ? Number(match[1]) : undefined;
      return { type, index: Number.isFinite(index) ? index : undefined };
    }
  }
  return null;
}

const LABEL_NAMES: Record<SongSection["type"], string> = {
  introducao: "Introdução",
  verso: "Verso",
  pre_refrao: "Pré-refrão",
  refrao: "Refrão",
  pos_refrao: "Pós-refrão",
  ponte: "Ponte",
  interludio: "Interlúdio",
  final: "Final",
  fala: "Fala",
  outro: "Outro",
};

/**
 * Suggests a section split for lyrics that don't already carry explicit
 * labels. This is a heuristic starting point — the user can always
 * relabel or re-slice sections manually in the editor.
 */
export function suggestSections(lyrics: string): SongSection[] {
  const blocks = splitIntoBlocks(lyrics);
  if (blocks.length === 0) return [];

  const normalizedBlocks = blocks.map((b) => normalize(b.lines.join(" ")));

  // A block that repeats (near-identical to another block) is a strong
  // signal of a chorus, since repetition across the song is the main
  // textual cue we have without audio.
  const occurrenceCount = new Map<string, number>();
  normalizedBlocks.forEach((norm) => {
    occurrenceCount.set(norm, (occurrenceCount.get(norm) ?? 0) + 1);
  });

  const sections: SongSection[] = [];
  let verseIndex = 0;

  blocks.forEach((block, i) => {
    const explicit = detectExplicitLabel(block);
    let type: SongSection["type"];
    let index: number | undefined;
    let text = block.lines.join("\n");

    if (explicit) {
      type = explicit.type;
      index = explicit.index;
      text = block.lines.slice(1).join("\n") || block.lines.join("\n");
    } else {
      const repeats = (occurrenceCount.get(normalizedBlocks[i]) ?? 0) > 1;
      if (repeats) {
        type = "refrao";
      } else if (i === 0 && blocks.length > 2 && block.lines.length <= 2) {
        type = "introducao";
      } else if (i === blocks.length - 1 && blocks.length > 2 && block.lines.length <= 2) {
        type = "final";
      } else {
        type = "verso";
        verseIndex += 1;
        index = verseIndex;
      }
    }

    const label = index ? `${LABEL_NAMES[type]} ${index}` : LABEL_NAMES[type];

    sections.push({
      id: `sec-${i + 1}`,
      type,
      index,
      label,
      text,
      startLine: block.startLine,
      endLine: block.endLine,
    });
  });

  return sections;
}
