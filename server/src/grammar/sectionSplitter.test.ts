import { describe, expect, it } from "vitest";
import { suggestSections } from "./sectionSplitter.js";

describe("suggestSections", () => {
  it("respects explicit labels typed by the user", () => {
    const lyrics = [
      "Verso 1",
      "Eu caminho por vales escuros",
      "",
      "Refrão",
      "Tu és fiel, tu és fiel",
      "",
      "Verso 2",
      "Minha alma descansa em ti",
    ].join("\n");

    const sections = suggestSections(lyrics);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe("verso");
    expect(sections[0].index).toBe(1);
    expect(sections[1].type).toBe("refrao");
    expect(sections[2].type).toBe("verso");
    expect(sections[2].index).toBe(2);
    expect(sections[0].text).toContain("vales escuros");
  });

  it("detects a repeated block as a probable chorus when there are no labels", () => {
    const lyrics = [
      "Eu vim buscar a tua face",
      "Nada mais importa aqui",
      "",
      "Tu és fiel, tu és fiel",
      "",
      "Caminho em fé cada manhã",
      "Contigo sigo, Senhor",
      "",
      "Tu és fiel, tu és fiel",
    ].join("\n");

    const sections = suggestSections(lyrics);
    const chorusSections = sections.filter((s) => s.type === "refrao");
    expect(chorusSections.length).toBe(2);
  });

  it("preserves original line ranges so the raw lyrics are never altered", () => {
    const lyrics = "Primeira linha\nSegunda linha";
    const sections = suggestSections(lyrics);
    expect(sections[0].startLine).toBe(0);
    expect(sections[0].endLine).toBe(1);
  });
});
