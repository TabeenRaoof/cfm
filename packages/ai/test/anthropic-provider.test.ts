/**
 * Tests the adapter's own logic — request shaping, cost arithmetic, the spend limit — against
 * a stubbed SDK client. None of these make a network call or need a credential; the smoke
 * script (scripts/smoke-anthropic.ts) is what exercises this against the real API, and only
 * when a key is present.
 */

import { describe, expect, it } from "vitest";
import { AnthropicProvider, SpendLimitExceededError } from "../src/providers/anthropic.ts";

function stubClient(create: (params: unknown) => Promise<unknown>) {
  return { messages: { create } };
}

describe("the client-side spend limit", () => {
  it("defaults to one cent, so a new caller cannot spend real money by accident", () => {
    const provider = new AnthropicProvider({ apiKey: "test" });
    // Bracket notation on a private field is not flagged by TS (a known gap in the private-
    // field access check), so no suppression comment is needed or accepted here.
    expect(provider["maxTotalSpendUsd"]).toBe(0.01);
  });

  it("refuses a call once the running total would exceed the limit", async () => {
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 0.001 });
    // @ts-expect-error stubbing the SDK client for a unit test
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "{}" }],
      // 1,000 input tokens @ $1/MTok = $0.001. Zero output tokens, so this call lands exactly
      // on the limit rather than over it — the point being tested is the SECOND call, which
      // has nowhere left to spend at all.
      usage: { input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 0 },
    }));

    const request = {
      model: "claude-haiku-4-5",
      system: "x",
      parts: [{ type: "text" as const, text: "hello" }],
      schema: { type: "object" },
      maxOutputTokens: 100,
    };

    await provider.generate(request); // spends exactly the limit
    await expect(provider.generate(request)).rejects.toBeInstanceOf(SpendLimitExceededError);
  });

  it("raising the limit explicitly is the only way past it", () => {
    const generous = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 5 });
    expect(generous["maxTotalSpendUsd"]).toBe(5);
  });
});

describe("cost arithmetic", () => {
  it("prices cached and fresh input tokens separately", async () => {
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 10 });
    // @ts-expect-error stubbing the SDK client
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "{}" }],
      // 1,000,000 total input tokens, 400,000 of them cached.
      usage: { input_tokens: 1_000_000, cache_read_input_tokens: 400_000, output_tokens: 0 },
    }));

    const result = await provider.generate({
      model: "claude-haiku-4-5",
      system: "x",
      parts: [{ type: "text", text: "y" }],
      schema: { type: "object" },
      maxOutputTokens: 10,
    });

    // 600K fresh @ $1/MTok + 400K cached @ $0.1/MTok = $0.6 + $0.04 = $0.64
    expect(result.usage.costUsd).toBeCloseTo(0.64, 6);
  });
});

describe("capability lookup", () => {
  it("refuses an unrecognised model rather than guessing its limits", () => {
    const provider = new AnthropicProvider({ apiKey: "test" });
    expect(() => provider.capabilities("claude-made-up-9")).toThrow(/No capability profile/);
  });

  it("reports Haiku 4.5's smaller context window against Sonnet 5's", () => {
    const provider = new AnthropicProvider({ apiKey: "test" });
    expect(provider.capabilities("claude-haiku-4-5").maxInputTokens).toBe(200_000);
    expect(provider.capabilities("claude-sonnet-5").maxInputTokens).toBe(1_000_000);
  });

  it("marks Haiku 4.5 as unable to pin inference geography", () => {
    // decisions.md D-029: inference_geo needs Claude 4.6+; Haiku 4.5 returns a 400.
    const provider = new AnthropicProvider({ apiKey: "test" });
    expect(provider.capabilities("claude-haiku-4-5").supportsGeoPinning).toBe(false);
    expect(provider.capabilities("claude-sonnet-5").supportsGeoPinning).toBe(true);
  });
});

describe("content shaping", () => {
  it("fails loudly when the response carries no text block", async () => {
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 10 });
    // @ts-expect-error stubbing the SDK client
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "tool_use" }],
      usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0 },
    }));
    await expect(
      provider.generate({
        model: "claude-haiku-4-5",
        system: "x",
        parts: [{ type: "text", text: "y" }],
        schema: { type: "object" },
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow(/contained no text block/);
  });
});
