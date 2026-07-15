import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};

export const isDemoMode = () => env.anthropicApiKey.trim().length === 0;
