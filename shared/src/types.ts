import { z } from "zod";
import {
  AIProducedAnalysisSchema,
  AnalysisFindingSchema,
  AnalysisResultSchema,
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  BibleLookupResponseSchema,
  BibleReferenceSchema,
  BiblicalContextAnalysisSchema,
  ChorusAnalysisSchema,
  CoherenceAnalysisSchema,
  CompositionFindingSchema,
  CongregationalAnalysisSchema,
  ConfidenceLevelSchema,
  FindingSeveritySchema,
  HighlightCategorySchema,
  RevisionModeSchema,
  TheologicalTraditionSchema,
  DesiredChangeLevelSchema,
  FinalReportSchema,
  GrammarFindingSchema,
  MoodAnalysisSchema,
  OverviewSummarySchema,
  ProsodyFindingSchema,
  RhymeFindingSchema,
  SongContextInputSchema,
  SongSectionSchema,
  TheologicalClaimSchema,
  ComposerQuestionSchema,
} from "./schemas.js";

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type HighlightCategory = z.infer<typeof HighlightCategorySchema>;
export type RevisionMode = z.infer<typeof RevisionModeSchema>;
export type TheologicalTradition = z.infer<typeof TheologicalTraditionSchema>;
export type DesiredChangeLevel = z.infer<typeof DesiredChangeLevelSchema>;

export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;
export type SongSection = z.infer<typeof SongSectionSchema>;
export type BibleReference = z.infer<typeof BibleReferenceSchema>;
export type BiblicalContextAnalysis = z.infer<typeof BiblicalContextAnalysisSchema>;
export type TheologicalClaim = z.infer<typeof TheologicalClaimSchema>;
export type GrammarFinding = z.infer<typeof GrammarFindingSchema>;
export type CompositionFinding = z.infer<typeof CompositionFindingSchema>;
export type ChorusAnalysis = z.infer<typeof ChorusAnalysisSchema>;
export type ProsodyFinding = z.infer<typeof ProsodyFindingSchema>;
export type RhymeFinding = z.infer<typeof RhymeFindingSchema>;
export type MoodAnalysis = z.infer<typeof MoodAnalysisSchema>;
export type CongregationalAnalysis = z.infer<typeof CongregationalAnalysisSchema>;
export type CoherenceAnalysis = z.infer<typeof CoherenceAnalysisSchema>;
export type OverviewSummary = z.infer<typeof OverviewSummarySchema>;
export type ComposerQuestion = z.infer<typeof ComposerQuestionSchema>;
export type SongContextInput = z.infer<typeof SongContextInputSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AIProducedAnalysis = z.infer<typeof AIProducedAnalysisSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type FinalReport = z.infer<typeof FinalReportSchema>;
export type BibleLookupResponse = z.infer<typeof BibleLookupResponseSchema>;
