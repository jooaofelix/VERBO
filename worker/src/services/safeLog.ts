/**
 * Never pass raw request payloads to logger.* — composers' lyrics may be
 * unpublished, personal work. This strips known free-text fields down to a
 * length before anything gets logged, so operational logs stay useful
 * without ever containing the letra itself.
 */
export function summarizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const REDACT_KEYS = new Set(["lyrics", "text", "originalLyrics", "revisedLyrics"]);
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (REDACT_KEYS.has(key) && typeof value === "string") {
      summary[key] = `<redacted, ${value.length} chars>`;
    } else if (typeof value === "string" && value.length > 200) {
      summary[key] = `<redacted, ${value.length} chars>`;
    } else {
      summary[key] = value;
    }
  }

  return summary;
}
