import { describe, expect, it } from "vitest";
import { AnalyzeRequestSchema, SongContextInputSchema } from "./schemas.js";

describe("SongContextInputSchema", () => {
  it("accepts an entirely empty context (no field is mandatory)", () => {
    const parsed = SongContextInputSchema.parse({});
    expect(parsed.theologicalTradition).toBe("nao_selecionar");
    expect(parsed.desiredChangeLevel).toBe("refinar_mantendo_voz");
  });
});

describe("AnalyzeRequestSchema", () => {
  it("rejects empty lyrics", () => {
    const result = AnalyzeRequestSchema.safeParse({ lyrics: "", context: {} });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    const result = AnalyzeRequestSchema.safeParse({
      lyrics: "Minha alma anela por tua casa",
      context: {},
    });
    expect(result.success).toBe(true);
  });
});
