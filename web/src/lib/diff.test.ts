import { describe, expect, it } from "vitest";
import { diffWords } from "./diff.js";

describe("diffWords", () => {
  it("marks everything as same when texts are identical", () => {
    const tokens = diffWords("Tu és fiel", "Tu és fiel");
    expect(tokens.every((t) => t.type === "same")).toBe(true);
  });

  it("detects an added word", () => {
    const tokens = diffWords("Tu és fiel", "Tu és sempre fiel");
    expect(tokens.some((t) => t.type === "added" && t.text === "sempre")).toBe(true);
  });

  it("detects a removed word", () => {
    const tokens = diffWords("Tu és sempre fiel", "Tu és fiel");
    expect(tokens.some((t) => t.type === "removed" && t.text === "sempre")).toBe(true);
  });

  it("reconstructs the new text from same+added tokens", () => {
    const oldText = "Caminho na fé";
    const newText = "Caminho firme na fé";
    const tokens = diffWords(oldText, newText);
    const reconstructed = tokens
      .filter((t) => t.type !== "removed")
      .map((t) => t.text)
      .join("");
    expect(reconstructed).toBe(newText);
  });
});
