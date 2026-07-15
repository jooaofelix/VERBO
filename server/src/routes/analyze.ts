import { AnalyzeRequestSchema } from "@verbo/shared";
import { Router } from "express";
import { runAnalysis } from "../analysisService.js";
import { SchemaRepairError } from "../ai/repair.js";

export const analyzeRouter = Router();

analyzeRouter.post("/analyze", async (req, res) => {
  const parsed = AnalyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Requisição inválida.",
      details: parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`),
    });
    return;
  }

  try {
    const { mode, result } = await runAnalysis(parsed.data);
    res.json({ mode, result });
  } catch (err) {
    if (err instanceof SchemaRepairError) {
      // Never log the lyrics themselves — only that validation failed.
      console.error("Falha ao validar resposta da IA contra o schema esperado.");
      res.status(502).json({
        error:
          "Não foi possível gerar uma análise estruturada válida desta vez. Tente novamente em instantes.",
      });
      return;
    }

    console.error("Erro inesperado ao analisar letra:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Erro inesperado ao processar a análise." });
  }
});
