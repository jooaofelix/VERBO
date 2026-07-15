import { DemoAIProvider } from "./demoProvider.js";
import { WorkersAIProvider } from "./workersAIProvider.js";
import type { AIAnalysisProvider } from "./provider.js";

/**
 * The AI binding ("env.AI") is only present when the Worker is actually
 * running under `wrangler dev`/`wrangler deploy` with the "ai" binding
 * configured in wrangler.jsonc. Any other context (plain `node`, a unit
 * test, a misconfigured deploy) falls back to the demo provider instead of
 * throwing — the app stays usable end-to-end, just clearly labeled.
 */
export function getAIProvider(ai: Ai | undefined): AIAnalysisProvider {
  return ai ? new WorkersAIProvider(ai) : new DemoAIProvider();
}

export type { AIAnalysisProvider, LyricsAnalysisInput } from "./provider.js";
