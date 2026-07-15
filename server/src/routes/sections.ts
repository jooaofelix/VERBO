import { z } from "zod";
import { Router } from "express";
import { suggestSections } from "../grammar/sectionSplitter.js";

export const sectionsRouter = Router();

const BodySchema = z.object({ lyrics: z.string().min(1) });

sectionsRouter.post("/sections/suggest", (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Envie um campo 'lyrics' não vazio." });
    return;
  }
  res.json({ sections: suggestSections(parsed.data.lyrics) });
});
