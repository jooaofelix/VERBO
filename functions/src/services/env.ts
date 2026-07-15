import { defineSecret, defineString } from "firebase-functions/params";

/**
 * Bound as a Cloud Functions secret (`firebase functions:secrets:set ANTHROPIC_API_KEY`)
 * in production. For local emulation, set ANTHROPIC_API_KEY in functions/.env —
 * defineSecret() falls back to process.env when running under the emulator.
 */
export const anthropicApiKeySecret = defineSecret("ANTHROPIC_API_KEY");

export const anthropicModelParam = defineString("ANTHROPIC_MODEL", {
  default: "claude-sonnet-5",
});

export function getAnthropicApiKey(): string {
  return anthropicApiKeySecret.value() || process.env.ANTHROPIC_API_KEY || "";
}

export function getAnthropicModel(): string {
  return anthropicModelParam.value() || "claude-sonnet-5";
}

export const isDemoMode = () => getAnthropicApiKey().trim().length === 0;
