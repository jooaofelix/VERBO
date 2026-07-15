export const MAX_LYRICS_LENGTH = 20_000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function assertLyricsSizeWithinLimit(lyrics: string): void {
  if (lyrics.length > MAX_LYRICS_LENGTH) {
    throw new ValidationError(
      `A letra excede o limite de ${MAX_LYRICS_LENGTH} caracteres permitido por análise.`
    );
  }
}
