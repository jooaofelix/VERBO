import { isDemoMode } from "../env.js";
import { AnthropicAIProvider } from "./anthropicProvider.js";
import { DemoAIProvider } from "./demoProvider.js";
import type { AIAnalysisProvider } from "./provider.js";

let cached: AIAnalysisProvider | null = null;

export function getAIProvider(): AIAnalysisProvider {
  if (!cached) {
    cached = isDemoMode() ? new DemoAIProvider() : new AnthropicAIProvider();
  }
  return cached;
}

export type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
