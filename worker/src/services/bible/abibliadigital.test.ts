import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExternalVerse, resolveBookAbbreviation } from "./abibliadigital.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveBookAbbreviation", () => {
  it("resolves common Portuguese book names to their abbreviation", () => {
    expect(resolveBookAbbreviation("Gênesis")).toBe("gn");
    expect(resolveBookAbbreviation("Salmos")).toBe("sl");
    expect(resolveBookAbbreviation("Romanos")).toBe("rm");
    expect(resolveBookAbbreviation("João")).toBe("jo");
  });

  it("is accent- and case-insensitive", () => {
    expect(resolveBookAbbreviation("SALMOS")).toBe("sl");
    expect(resolveBookAbbreviation("joao")).toBe("jo");
    expect(resolveBookAbbreviation("genesis")).toBe("gn");
  });

  it("handles numbered books with either numeral style", () => {
    expect(resolveBookAbbreviation("1 Coríntios")).toBe("1co");
    expect(resolveBookAbbreviation("I Coríntios")).toBe("1co");
    expect(resolveBookAbbreviation("2 Timóteo")).toBe("2tm");
  });

  it("returns null for an unrecognized book", () => {
    expect(resolveBookAbbreviation("Livro Inexistente")).toBeNull();
  });
});

describe("fetchExternalVerse", () => {
  it("returns null without making any network call when no token is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchExternalVerse("Salmos", 126, 5, undefined);
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null without making any network call for an unrecognized book, even with a token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchExternalVerse("Livro Inexistente", 1, 1, "fake-token");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the verse text on a successful response, using the Bearer token and correct path", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "  Ele restaura a minha alma.  " }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchExternalVerse("Salmos", 23, 3, "fake-token");
    expect(result).toEqual({ text: "Ele restaura a minha alma.", version: "acf" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://www.abibliadigital.com.br/api/verses/acf/sl/23/3");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer fake-token" });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );
    const result = await fetchExternalVerse("Salmos", 999, 999, "fake-token");
    expect(result).toBeNull();
  });

  it("returns null when the response has no usable text field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    );
    const result = await fetchExternalVerse("Salmos", 23, 3, "fake-token");
    expect(result).toBeNull();
  });

  it("returns null on a network error, never throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const result = await fetchExternalVerse("Salmos", 23, 3, "fake-token");
    expect(result).toBeNull();
  });
});
