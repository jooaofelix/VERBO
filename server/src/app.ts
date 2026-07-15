import cors from "cors";
import express from "express";
import { env, isDemoMode } from "./env.js";
import { analyzeRouter } from "./routes/analyze.js";
import { bibleRouter } from "./routes/bible.js";
import { sectionsRouter } from "./routes/sections.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mode: isDemoMode() ? "demo" : "live" });
  });

  app.use("/api", analyzeRouter);
  app.use("/api", bibleRouter);
  app.use("/api", sectionsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
  });

  return app;
}
