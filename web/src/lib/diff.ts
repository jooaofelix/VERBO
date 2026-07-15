export interface DiffToken {
  text: string;
  type: "same" | "added" | "removed";
}

/**
 * Word-level LCS diff. Good enough for song-length texts; not meant for
 * huge documents. Mirrors web/src/lib/diff.ts so the client and the
 * compareVersions callable agree on what "changed" means.
 */
export function diffWords(oldText: string, newText: string): DiffToken[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  const n = oldWords.length;
  const m = newWords.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        oldWords[i] === newWords[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldWords[i] === newWords[j]) {
      tokens.push({ text: oldWords[i], type: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ text: oldWords[i], type: "removed" });
      i++;
    } else {
      tokens.push({ text: newWords[j], type: "added" });
      j++;
    }
  }
  while (i < n) {
    tokens.push({ text: oldWords[i], type: "removed" });
    i++;
  }
  while (j < m) {
    tokens.push({ text: newWords[j], type: "added" });
    j++;
  }

  return tokens;
}
