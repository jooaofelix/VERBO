import { isDemoMode } from "../services/env.js";
import { AnthropicAIProvider } from "./anthropicProvider.js";
import { DemoAIProvider } from "./demoProvider.js";
import type { AIAnalysisProvider } from "./provider.js";

/**
 * Not cached across invocations: whether we're in demo mode depends on a
 * Cloud Functions secret that's only guaranteed bound once the function is
 * actually invoked, so we re-check every call instead of trusting a
 * module-level singleton computed on a possibly-too-early first call.
 */
export function getAIProvider(): AIAnalysisProvider {
  return isDemoMode() ? new DemoAIProvider() : new AnthropicAIProvider();
}

export type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
