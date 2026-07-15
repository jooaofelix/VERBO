import type { AnalyzeRequest, SongSection } from "@verbo/shared";
import { describe, expect, it, vi } from "vitest";
import { DemoAIProvider } from "./demoProvider.js";
import { WorkersAIProvider } from "./workersAIProvider.js";

function baseRequest(): AnalyzeRequest {
  return {
    lyrics: "Tu és fiel\n\nTu és fiel, tu és fiel",
    sections: [],
    context: {
      theologicalTradition: "nao_selecionar",
      desiredChangeLevel: "refinar_mantendo_voz",
      bibleReferencesProvidedByUser: [],
    },
    revisionMode: "completa",
    bibleTranslationPreference: "dominio_publico_almeida",
  };
}

function sections(): SongSection[] {
  return [
    { id: "sec-1", type: "verso", index: 1, label: "Verso 1", text: "Tu és fiel", startLine: 0, endLine: 0 },
  ];
}

async function validFixture() {
  return new DemoAIProvider().analyzeLyrics({
    request: baseRequest(),
    sections: sections(),
    deterministicGrammar: [],
    prosody: [],
  });
}

describe("WorkersAIProvider", () => {
  it("accepts a well-formed JSON object returned directly by env.AI.run", async () => {
    const fixture = await validFixture();
    const run = vi.fn().mockResolvedValue({ response: fixture });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest(),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.overview.perceivedCentralMessage).toBe(fixture.overview.perceivedCentralMessage);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("accepts a JSON string wrapped in a markdown code fence", async () => {
    const fixture = await validFixture();
    const run = vi.fn().mockResolvedValue({ response: "```json\n" + JSON.stringify(fixture) + "\n```" });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest(),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.overview.perceivedCentralMessage).toBe(fixture.overview.perceivedCentralMessage);
  });

  it("retries once with a repair prompt when the first response fails schema validation, and succeeds", async () => {
    const fixture = await validFixture();
    const run = vi
      .fn()
      .mockResolvedValueOnce({ response: { not: "valid" } })
      .mockResolvedValueOnce({ response: fixture });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    const result = await provider.analyzeLyrics({
      request: baseRequest(),
      sections: sections(),
      deterministicGrammar: [],
      prosody: [],
    });

    expect(result.overview.perceivedCentralMessage).toBe(fixture.overview.perceivedCentralMessage);
    expect(run).toHaveBeenCalledTimes(2);
    // The repair turn must show the model its own bad output plus the errors.
    const secondCallMessages = run.mock.calls[1][1].messages;
    expect(secondCallMessages.some((m: { role: string }) => m.role === "assistant")).toBe(true);
  });

  it("throws if the model still fails schema validation after the repair attempt", async () => {
    const run = vi.fn().mockResolvedValue({ response: { not: "valid" } });
    const provider = new WorkersAIProvider({ run } as unknown as Ai);

    await expect(
      provider.analyzeLyrics({
        request: baseRequest(),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      })
    ).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
