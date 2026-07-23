import { afterEach, describe, expect, it, vi } from "vitest";
import { runLanguageToolCheck } from "./languageTool.js";

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runLanguageToolCheck", () => {
  it("maps a match into a GrammarFinding with explanation and both correction options", async () => {
    mockFetchOnce({
      jsonBody: {
        matches: [
          {
            message: "O verbo não concorda com o sujeito.",
            offset: 4,
            length: 3,
            replacements: [{ value: "opção um" }, { value: "opção dois" }],
            context: { text: "Sua mao forte me salvou", offset: 4, length: 3 },
            rule: { id: "AGREEMENT_RULE", category: { id: "GRAMMAR", name: "Gramática" } },
          },
        ],
      },
    });

    const [finding] = await runLanguageToolCheck("Sua mao forte me salvou");

    expect(finding.source).toBe("languagetool");
    expect(finding.type).toBe("concordancia_verbal");
    expect(finding.classification).toBe("erro_provavel");
    expect(finding.poeticLicensePossible).toBe(false);
    expect(finding.explanation).toBe("O verbo não concorda com o sujeito.");
    expect(finding.possibleCorrection).toBe("opção um");
    expect(finding.alternativeCorrection).toBe("opção dois");
    expect(finding.originalExcerpt).toBe("mao");
  });

  it("classifies style-only categories as escolha_estilistica with poeticLicensePossible=true", async () => {
    mockFetchOnce({
      jsonBody: {
        matches: [
          {
            message: "Considere uma construção mais direta.",
            offset: 0,
            length: 5,
            context: { text: "Texto qualquer", offset: 0, length: 5 },
            rule: { id: "STYLE_RULE", category: { id: "STYLE", name: "Estilo" } },
          },
        ],
      },
    });

    const [finding] = await runLanguageToolCheck("Texto qualquer");
    expect(finding.classification).toBe("escolha_estilistica");
    expect(finding.poeticLicensePossible).toBe(true);
  });

  it("falls back to a generic type for an unrecognized rule category", async () => {
    mockFetchOnce({
      jsonBody: {
        matches: [
          {
            message: "Observação genérica.",
            offset: 0,
            length: 3,
            context: { text: "Abc def", offset: 0, length: 3 },
            rule: { id: "SOME_OTHER_RULE" },
          },
        ],
      },
    });

    const [finding] = await runLanguageToolCheck("Abc def");
    expect(finding.type).toBe("construcao_pouco_natural");
  });

  it("returns an empty array when the API responds with a non-2xx status (e.g. rate limited)", async () => {
    mockFetchOnce({ ok: false, status: 429, jsonBody: {} });
    const findings = await runLanguageToolCheck("Qualquer letra de música aqui.");
    expect(findings).toEqual([]);
  });

  it("returns an empty array when the response shape is unexpected", async () => {
    mockFetchOnce({ jsonBody: { somethingElse: true } });
    const findings = await runLanguageToolCheck("Qualquer letra de música aqui.");
    expect(findings).toEqual([]);
  });

  it("returns an empty array on a network error, never throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const findings = await runLanguageToolCheck("Qualquer letra de música aqui.");
    expect(findings).toEqual([]);
  });

  it("skips the network call entirely for empty/whitespace-only lyrics", async () => {
    const fetchMock = mockFetchOnce({ jsonBody: { matches: [] } });
    const findings = await runLanguageToolCheck("   \n  ");
    expect(findings).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
