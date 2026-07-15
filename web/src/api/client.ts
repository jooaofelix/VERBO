import type { AnalyzeRequest, AnalyzeResponse, BibleLookupResponse, SongSection } from "@verbo/shared";

export class ApiError extends Error {}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error || `Erro inesperado (HTTP ${res.status}).`);
  }
  return body;
}

export async function analyzeLyrics(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseJsonOrThrow(res) as Promise<AnalyzeResponse>;
}

export async function lookupBibleReference(query: string): Promise<BibleLookupResponse> {
  const res = await fetch(`/api/bible/reference?query=${encodeURIComponent(query)}`);
  return parseJsonOrThrow(res) as Promise<BibleLookupResponse>;
}

export async function suggestSections(lyrics: string): Promise<SongSection[]> {
  const res = await fetch("/api/sections/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lyrics }),
  });
  const body = await parseJsonOrThrow(res);
  return body.sections as SongSection[];
}
