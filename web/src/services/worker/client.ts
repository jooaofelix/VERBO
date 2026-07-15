import type { AnalyzeRequest, AnalyzeResponse, SongSection } from "@verbo/shared";
import { auth } from "../firebase/auth.js";

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || "").replace(/\/$/, "");

export class WorkerApiError extends Error {}

async function authorizedFetch(path: string, body: unknown): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new WorkerApiError("É necessário estar autenticado para analisar uma letra.");
  }
  const idToken = await user.getIdToken();

  return fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WorkerApiError(body.error || `Erro inesperado (HTTP ${res.status}).`);
  }
  return body;
}

/**
 * The Cloudflare Worker is completely stateless — it never touches
 * Firestore. It only verifies the Firebase ID token and runs the (text-only)
 * analysis pipeline; the caller is responsible for reading/writing whatever
 * Firestore documents it needs, same as any other authenticated client.
 */
export async function analyzeLyrics(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await authorizedFetch("/analyze", request);
  return parseJsonOrThrow(res) as Promise<AnalyzeResponse>;
}

export async function suggestSections(lyrics: string): Promise<{ sections: SongSection[] }> {
  const res = await authorizedFetch("/sections/suggest", { lyrics });
  return parseJsonOrThrow(res) as Promise<{ sections: SongSection[] }>;
}
