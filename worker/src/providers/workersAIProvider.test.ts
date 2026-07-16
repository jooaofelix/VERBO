import type { AnalyzeRequest, SongSection } from "@verbo/shared";
import { describe, expect, it, vi } from "vitest";
import { DemoAIProvider } from "./demoProvider.js";
import { AITimeoutError, WorkersAIProvider } from "./workersAIProvider.js";

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

  describe("timeout handling", () => {
    it("retries once with a simplified prompt after a 3046 timeout, and succeeds", async () => {
      const fixture = await validFixture();
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("3046: Request timeout"))
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

      // The retry must not chain off the first (failed) call — no assistant
      // turn from a repair loop, and the lyrics must still be present.
      const retryOptions = run.mock.calls[1][1] as { messages: Array<{ role: string; content: string }> };
      expect(retryOptions.messages.some((m) => m.role === "assistant")).toBe(false);
      expect(retryOptions.messages.some((m) => m.content.includes("Tu és fiel"))).toBe(true);
    });

    it("retries once with a simplified prompt after a 3007 timeout, and succeeds", async () => {
      const fixture = await validFixture();
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error 3007: Request timeout while running model"))
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
    });

    it("recognizes a bare 'Request timeout' message without a numeric code", async () => {
      const fixture = await validFixture();
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("Request timeout"))
        .mockResolvedValueOnce({ response: fixture });
      const provider = new WorkersAIProvider({ run } as unknown as Ai);

      await provider.analyzeLyrics({
        request: baseRequest(),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      });

      expect(run).toHaveBeenCalledTimes(2);
    });

    it("uses a smaller max_tokens budget on the timeout retry", async () => {
      const fixture = await validFixture();
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("3046: Request timeout"))
        .mockResolvedValueOnce({ response: fixture });
      const provider = new WorkersAIProvider({ run } as unknown as Ai);

      await provider.analyzeLyrics({
        request: baseRequest(),
        sections: sections(),
        deterministicGrammar: [],
        prosody: [],
      });

      const firstOptions = run.mock.calls[0][1] as { max_tokens: number };
      const retryOptions = run.mock.calls[1][1] as { max_tokens: number };
      expect(retryOptions.max_tokens).toBeLessThan(firstOptions.max_tokens);
    });

    it("does not run the generic schema-repair loop when the first attempt times out", async () => {
      // Even though the retry response fails schema validation, the call
      // count must stop at 2 (first attempt + single timeout retry) — never
      // a 3rd repair-style call.
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("3046: Request timeout"))
        .mockResolvedValueOnce({ response: { not: "valid" } });
      const provider = new WorkersAIProvider({ run } as unknown as Ai);

      await expect(
        provider.analyzeLyrics({
          request: baseRequest(),
          sections: sections(),
          deterministicGrammar: [],
          prosody: [],
        })
      ).rejects.toThrow(AITimeoutError);
      expect(run).toHaveBeenCalledTimes(2);
    });

    it("throws AITimeoutError when both the first attempt and the retry time out", async () => {
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error("3046: Request timeout"))
        .mockRejectedValueOnce(new Error("3007: Request timeout"));
      const provider = new WorkersAIProvider({ run } as unknown as Ai);

      await expect(
        provider.analyzeLyrics({
          request: baseRequest(),
          sections: sections(),
          deterministicGrammar: [],
          prosody: [],
        })
      ).rejects.toThrow(AITimeoutError);
      expect(run).toHaveBeenCalledTimes(2);
    });

    it("lets a non-timeout error from the first attempt propagate without retrying", async () => {
      const run = vi.fn().mockRejectedValue(new Error("500: Internal error"));
      const provider = new WorkersAIProvider({ run } as unknown as Ai);

      await expect(
        provider.analyzeLyrics({
          request: baseRequest(),
          sections: sections(),
          deterministicGrammar: [],
          prosody: [],
        })
      ).rejects.toThrow("500: Internal error");
      expect(run).toHaveBeenCalledTimes(1);
    });
  });
});
