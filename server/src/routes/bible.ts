import { Router } from "express";
import { lookupVerse } from "../bible/lookup.js";

export const bibleRouter = Router();

bibleRouter.get("/bible/reference", (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query : "";
  if (!query.trim()) {
    res.status(400).json({ error: "Parâmetro 'query' é obrigatório." });
    return;
  }
  res.json(lookupVerse(query));
});
