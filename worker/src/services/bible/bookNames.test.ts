import { describe, expect, it } from "vitest";
import { translateBookNameToPortuguese } from "./bookNames.js";

describe("translateBookNameToPortuguese", () => {
  it("translates a common English book name to Portuguese", () => {
    expect(translateBookNameToPortuguese("Romans")).toBe("romanos");
    expect(translateBookNameToPortuguese("John")).toBe("joao");
    expect(translateBookNameToPortuguese("Psalms")).toBe("salmos");
  });

  it("is case-insensitive", () => {
    expect(translateBookNameToPortuguese("romans")).toBe("romanos");
    expect(translateBookNameToPortuguese("ROMANS")).toBe("romanos");
  });

  it("handles numbered books with a leading numeral or roman numeral", () => {
    expect(translateBookNameToPortuguese("1 Corinthians")).toBe("1 corintios");
    expect(translateBookNameToPortuguese("I Corinthians")).toBe("1 corintios");
    expect(translateBookNameToPortuguese("2 Timothy")).toBe("2 timoteo");
  });

  it("returns the input unchanged when it's already Portuguese or unrecognized", () => {
    expect(translateBookNameToPortuguese("Romanos")).toBe("Romanos");
    expect(translateBookNameToPortuguese("Não é um livro")).toBe("Não é um livro");
  });
});
