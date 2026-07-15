import { describe, expect, it } from "vitest";
import { runDeterministicChecks } from "./deterministicChecks.js";
import type { SongSection } from "@verbo/shared";

function section(text: string): SongSection {
  return {
    id: "sec-1",
    type: "verso",
    index: 1,
    label: "Verso 1",
    text,
    startLine: 0,
    endLine: text.split("\n").length - 1,
  };
}

describe("runDeterministicChecks", () => {
  it("flags double spaces", () => {
    const findings = runDeterministicChecks([section("Eu  te louvo")]);
    expect(findings.some((f) => f.type === "pontuacao" && f.originalExcerpt.includes("  "))).toBe(
      true
    );
  });

  it("flags immediately repeated words", () => {
    const findings = runDeterministicChecks([section("Eu eu quero te louvar")]);
    expect(findings.some((f) => f.type === "repeticao_involuntaria")).toBe(true);
  });

  it("flags overly long lines as needing melody, not as hard errors", () => {
    const longLine =
      "Eu quero muito mesmo agora te louvar com toda a minha força e coração inteiro sempre";
    const findings = runDeterministicChecks([section(longLine)]);
    const found = findings.find((f) => f.type === "frase_longa");
    expect(found).toBeDefined();
    expect(found?.classification).toBe("nao_determinado_sem_melodia");
  });

  it("flags known pleonasms as a stylistic observation, not a hard error", () => {
    const findings = runDeterministicChecks([section("Vou subir para cima e te encontrar")]);
    const found = findings.find((f) => f.type === "pleonasmo");
    expect(found).toBeDefined();
    expect(found?.classification).toBe("escolha_estilistica");
  });

  it("does not flag clean, short, correctly spaced lines", () => {
    const findings = runDeterministicChecks([section("Tu és fiel, Senhor")]);
    expect(findings).toHaveLength(0);
  });
});
