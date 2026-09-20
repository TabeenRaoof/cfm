/**
 * Fake providers for tests.
 *
 * The capability profiles matter more than the fake responses. They are the shapes a real
 * swap actually takes — a smaller context window, no native PDF, no native structured output,
 * no batch tier — and portability.test.ts runs every registered task against all of them. A
 * task that only works on one profile is a task that will break on the day the provider
 * changes, and it fails in CI instead.
 */

import type { GenerationRequest, GenerationResult, ModelCapabilities, Provider } from "./provider.ts";
import { estimateTokens } from "./provider.ts";
import type { UsageRecord, UsageSink } from "./gateway.ts";

export const FRONTIER_PROFILE: ModelCapabilities = {
  maxInputTokens: 1_000_000,
  maxOutputTokens: 64_000,
  acceptsPdf: true,
  acceptsImages: true,
  structuredOutput: "native",
  supportsBatch: true,
  supportsPromptCache: true,
  costPerMTokInput: 2,
  costPerMTokOutput: 10,
  costPerMTokCachedInput: 0.2,
  costPerMTokCacheWrite: 2.5,
  supportsGeoPinning: true,
};

/** A small, cheap model: the shape most likely to break an unbounded request. */
export const SMALL_PROFILE: ModelCapabilities = {
  ...FRONTIER_PROFILE,
  maxInputTokens: 200_000,
  maxOutputTokens: 8_000,
  acceptsPdf: false,
  structuredOutput: "tool",
  costPerMTokInput: 1,
  costPerMTokOutput: 5,
  costPerMTokCachedInput: 0.1,
  costPerMTokCacheWrite: 1.25,
  // Mirrors a real constraint: the cheap classification model is often the one that cannot pin
  // a geography, so a data-residency requirement can force a more expensive route.
  supportsGeoPinning: false,
};

/** A provider with no native schema support and no batch tier. */
export const MINIMAL_PROFILE: ModelCapabilities = {
  ...SMALL_PROFILE,
  acceptsPdf: false,
  acceptsImages: true,
  structuredOutput: "prompted",
  supportsBatch: false,
  supportsPromptCache: false,
  costPerMTokCacheWrite: 1,
  supportsGeoPinning: false,
};

export class FakeProvider implements Provider {
  readonly calls: GenerationRequest[] = [];
  readonly id: string;
  private readonly profile: ModelCapabilities;
  private readonly respond: (request: GenerationRequest) => unknown;

  constructor(
    id: string,
    profile: ModelCapabilities,
    respond: (request: GenerationRequest) => unknown,
  ) {
    this.id = id;
    this.profile = profile;
    this.respond = respond;
  }

  capabilities(): ModelCapabilities {
    return this.profile;
  }

  estimateInputTokens(request: GenerationRequest): number {
    return estimateTokens(request.parts, 1_900);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    this.calls.push(request);
    const inputTokens = this.estimateInputTokens(request);
    const outputTokens = 50;
    return {
      value: this.respond(request),
      model: request.model,
      providerId: this.id,
      usage: {
        inputTokens,
        cachedInputTokens: 0,
        outputTokens,
        costUsd:
          (inputTokens / 1_000_000) * this.profile.costPerMTokInput +
          (outputTokens / 1_000_000) * this.profile.costPerMTokOutput,
      },
    };
  }
}

export class RecordingUsageSink implements UsageSink {
  readonly entries: UsageRecord[] = [];
  record(entry: UsageRecord): void {
    this.entries.push(entry);
  }
  get totalCostUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
  }
  get modelCallCount(): number {
    return this.entries.filter((e) => !e.resolvedWithoutModel).length;
  }
}
