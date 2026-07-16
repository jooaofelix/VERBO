import { Timestamp } from "firebase/firestore";
import type { AnalysisResult, SongContextInput, SongSection } from "@verbo/shared";
import type { AnalysisDoc, SongDoc, VersionDoc, WithId } from "../types/firestore.js";

/**
 * Old documents (from earlier phases of this app, or hand-edited/imported
 * data) may use different field names, omit fields the current shape
 * requires, or store timestamps in a different form. These normalizers
 * accept whatever Firestore actually returns and always produce a
 * schema-valid, displayable document — never throwing, never leaving a
 * screen with nothing to render just because one field is missing or named
 * differently than expected.
 */

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value && typeof value === "object" && "seconds" in (value as Record<string, unknown>)) {
    // Some legacy exports/imports serialize Timestamps as plain
    // {seconds, nanoseconds} objects instead of real Timestamp instances.
    const v = value as { seconds: number; nanoseconds?: number };
    if (typeof v.seconds === "number") return new Timestamp(v.seconds, v.nanoseconds ?? 0);
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return Timestamp.now();
}

/**
 * Accepts a raw "song"/"project" document that might predate the current
 * shape — `name`/`songTitle` instead of `title`, a missing
 * `currentVersionId`, or old-format timestamps — and returns a
 * schema-valid WithId<SongDoc>.
 */
export function normalizeLegacyProject(id: string, raw: unknown): WithId<SongDoc> {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id,
    title:
      asString(data.title) ||
      asString(data.songTitle) ||
      asString(data.name) ||
      "Composição sem título",
    author: asOptionalString(data.author) ?? asOptionalString(data.artist),
    language: asString(data.language, "pt-BR"),
    congregational: Boolean(data.congregational),
    hasAudio: Boolean(data.hasAudio),
    currentVersionId: asOptionalString(data.currentVersionId),
    lastAnalysisSummary: asOptionalString(data.lastAnalysisSummary),
    userId: asString(data.userId),
    status: data.status === "archived" ? "archived" : "active",
    version: typeof data.version === "number" ? data.version : 1,
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt ?? data.createdAt),
  };
}

const VALID_ANALYSIS_STATUSES = new Set(["pending", "completed", "error"]);

/**
 * Accepts a raw "version" document that may be missing `versionName`,
 * store the lyrics under a different key, lack `currentAnalysisId`
 * (older field name `analysisId`), or have no context/sections at all.
 */
export function normalizeLegacyVersion(id: string, raw: unknown): WithId<VersionDoc> {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawContext = (data.context && typeof data.context === "object" ? data.context : {}) as Partial<SongContextInput>;

  const context: SongContextInput = {
    ...rawContext,
    theologicalTradition: rawContext.theologicalTradition ?? "nao_selecionar",
    desiredChangeLevel: rawContext.desiredChangeLevel ?? "refinar_mantendo_voz",
    bibleReferencesProvidedByUser: Array.isArray(rawContext.bibleReferencesProvidedByUser)
      ? rawContext.bibleReferencesProvidedByUser
      : [],
  };

  const currentAnalysisId = asOptionalString(data.currentAnalysisId) ?? asOptionalString(data.analysisId);
  const rawAnalysisStatus = typeof data.analysisStatus === "string" ? data.analysisStatus : undefined;

  return {
    id,
    versionName:
      asString(data.versionName) || asString(data.name) || asString(data.title) || "Versão",
    lyrics: asString(data.lyrics) || asString(data.text) || asString(data.content) || "",
    sections: Array.isArray(data.sections) ? (data.sections as SongSection[]) : [],
    context,
    authorNotes: asOptionalString(data.authorNotes),
    sourceVersionId: asOptionalString(data.sourceVersionId),
    analysisStatus:
      rawAnalysisStatus && VALID_ANALYSIS_STATUSES.has(rawAnalysisStatus)
        ? (rawAnalysisStatus as VersionDoc["analysisStatus"])
        : currentAnalysisId
          ? "completed"
          : "pending",
    currentAnalysisId,
    approved: Boolean(data.approved),
    findingDecisions:
      data.findingDecisions && typeof data.findingDecisions === "object"
        ? (data.findingDecisions as VersionDoc["findingDecisions"])
        : {},
    userId: asString(data.userId),
    status: data.status === "archived" ? "archived" : "active",
    version: typeof data.version === "number" ? data.version : 1,
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt ?? data.createdAt),
  };
}

/**
 * Accepts a raw "analysis" document. Returns null (not a schema-valid
 * stand-in) only when there is genuinely no usable `result` to show —
 * callers treat that the same as "this version has no report yet",
 * never as a crash.
 */
export function normalizeLegacyAnalysis(id: string, raw: unknown): WithId<AnalysisDoc> | null {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result = data.result && typeof data.result === "object" ? (data.result as AnalysisResult) : null;
  if (!result) return null;

  return {
    id,
    versionId: asString(data.versionId),
    mode: data.mode === "demo" ? "demo" : "live",
    result: {
      ...result,
      sectionStatus: result.sectionStatus ?? {},
      grammarFindings: Array.isArray(result.grammarFindings) ? result.grammarFindings : [],
      bibleReferences: Array.isArray(result.bibleReferences) ? result.bibleReferences : [],
    } as AnalysisResult,
    userId: asString(data.userId),
    status: "completed",
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt ?? data.createdAt),
  };
}
