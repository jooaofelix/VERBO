import { describe, expect, it } from "vitest";
import { analyzeProsody } from "./prosody.js";
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

describe("analyzeProsody", () => {
  it("produces one finding per non-empty line", () => {
    const findings = analyzeProsody([section("Primeira linha\n\nSegunda linha")]);
    expect(findings).toHaveLength(2);
  });

  it("estimates a plausible syllable count for a short line", () => {
    const findings = analyzeProsody([section("Tu és fiel")]);
    expect(findings[0].approxSyllableCount).toBeGreaterThan(0);
    expect(findings[0].approxSyllableCount).toBeLessThan(8);
    expect(findings[0].lineLengthClass).toBe("curta");
  });

  it("classifies a long line as longa", () => {
    const findings = analyzeProsody([
      section("Eu quero muito mesmo agora te louvar com toda a minha força e coração inteiro"),
    ]);
    expect(findings[0].lineLengthClass).toBe("longa");
  });

  it("never claims certainty — every finding carries a fluency note, not a hard verdict", () => {
    const findings = analyzeProsody([section("Tu és fiel")]);
    expect(findings[0].fluencyNote).toBeTruthy();
  });
});
