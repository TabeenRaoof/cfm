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
  // Verified against Anthropic's prompt-caching documentation 2026-09-20: `input_tokens` is
  // ONLY the tokens after the last cache breakpoint, already exclusive of both
  // `cache_read_input_tokens` and `cache_creation_input_tokens` — the three buckets sum to the
  // total, none is a subset of another. These fixtures use realistic non-overlapping buckets
  // rather than the previous version's "1,000,000 total, 400,000 of them cached" framing, which
  // encoded the wrong mental model and matched a bug that has since been fixed.

  it("prices fresh and cached input tokens as separate, non-overlapping buckets", async () => {
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 10 });
    // @ts-expect-error stubbing the SDK client
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "{}" }],
      // 600K fresh, 400K read from an existing cache entry, nothing newly written.
      usage: {
        input_tokens: 600_000,
        cache_read_input_tokens: 400_000,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
      },
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
    expect(result.usage.inputTokens).toBe(600_000);
    expect(result.usage.cachedInputTokens).toBe(400_000);
    expect(result.usage.cacheWriteTokens).toBe(0);
  });

  it("prices a cache write at its premium over base input — the half of the arithmetic a reads-are-cheap model leaves out", async () => {
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 10 });
    // @ts-expect-error stubbing the SDK client
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "{}" }],
      // First call against a new cacheable prefix: nothing to read yet, 100K tokens written.
      usage: {
        input_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 100_000,
        output_tokens: 0,
      },
    }));

    const result = await provider.generate({
      model: "claude-haiku-4-5",
      system: "x",
      parts: [{ type: "text", cacheable: true, text: "y" }],
      schema: { type: "object" },
      maxOutputTokens: 10,
    });

    // 50 fresh @ $1/MTok (negligible) + 100K write @ $1.25/MTok (Haiku 4.5's 5m-cache premium)
    expect(result.usage.cacheWriteTokens).toBe(100_000);
    expect(result.usage.costUsd).toBeCloseTo((50 / 1_000_000) * 1 + (100_000 / 1_000_000) * 1.25, 6);
  });

  it("treats the three input buckets as additive, never subtracting one from another", async () => {
    // A regression guard for the specific bug this fixed: input_tokens is not a superset that
    // cache_read_input_tokens must be subtracted out of.
    const provider = new AnthropicProvider({ apiKey: "test", maxTotalSpendUsd: 10 });
    // @ts-expect-error stubbing the SDK client
    provider["client"] = stubClient(async () => ({
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "{}" }],
      usage: {
        input_tokens: 1_000,
        cache_read_input_tokens: 1_000,
        cache_creation_input_tokens: 1_000,
        output_tokens: 0,
      },
    }));

    const result = await provider.generate({
      model: "claude-haiku-4-5",
      system: "x",
      parts: [{ type: "text", text: "y" }],
      schema: { type: "object" },
      maxOutputTokens: 10,
    });

    // 1,000 fresh @ $1 + 1,000 cached @ $0.1 + 1,000 write @ $1.25, all per MTok.
    const expected = (1_000 / 1_000_000) * 1 + (1_000 / 1_000_000) * 0.1 + (1_000 / 1_000_000) * 1.25;
    expect(result.usage.costUsd).toBeCloseTo(expected, 8);
    // Not (1000 - 1000) = 0, which is what the pre-fix subtraction would have produced.
    expect(result.usage.inputTokens).toBe(1_000);
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
