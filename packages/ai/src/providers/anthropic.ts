/**
 * The Anthropic adapter — the ONLY file in this codebase permitted to import an Anthropic SDK.
 * `test/boundary.test.ts` enforces that; see packages/ai/README.md for what a provider swap
 * does and does not preserve.
 *
 * MODEL IDS AND PRICES BELOW WERE VERIFIED AGAINST CURRENT ANTHROPIC DOCUMENTATION ON
 * 2026-09-19. Per tabeen_CLAUDE.md, never restate them from memory in a later session — reread
 * the current pricing page and the Models API before trusting anything in this file again.
 */

import Anthropic from "@anthropic-ai/sdk";

import type {
  ContentPart,
  GenerationRequest,
  GenerationResult,
  ModelCapabilities,
  Provider,
} from "../provider.ts";

/**
 * Per-page PDF cost for the pre-send budget check. Anthropic's PDF guidance (verified 2026-09-26,
 * platform.claude.com/docs/en/build-with-claude/pdf-support): each page is converted to an image
 * AND its text extracted — "1,500–3,000 tokens per page" for the text, plus the page image at
 * vision rates (~1,600 for a typical page). 5,000 covers the top of the text range plus the image.
 * An over-estimate only refuses sooner; an under-estimate lets a long PDF past the budget.
 */
export const PDF_TOKENS_PER_PAGE = 5_000;

/**
 * Capability profiles for the models this product actually routes to (`02-` §6.3):
 * classification on Haiku 4.5, extraction on Sonnet 5. Verified 2026-09-19.
 *
 * Haiku 4.5 has a 200K context window against Sonnet 5 and Opus 5's 1M, which is why the
 * classify task's budget (6,000 input tokens, `packages/ai/src/tasks/classify-document.ts`) is
 * nowhere near the ceiling — it is sized for cost, not for the model's limit.
 */
const CAPABILITIES: Readonly<Record<string, ModelCapabilities>> = {
  "claude-haiku-4-5": {
    maxInputTokens: 200_000,
    maxOutputTokens: 8_192,
    acceptsPdf: true,
    acceptsImages: true,
    structuredOutput: "native",
    supportsBatch: true,
    supportsPromptCache: true,
    costPerMTokInput: 1,
    costPerMTokOutput: 5,
    costPerMTokCachedInput: 0.1,
    costPerMTokCacheWrite: 1.25,
    // inference_geo needs Claude 4.6+ (decisions.md D-029); Haiku 4.5 returns a 400.
    supportsGeoPinning: false,
  },
  "claude-sonnet-5": {
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
  },
};

export interface AnthropicProviderOptions {
  readonly apiKey?: string;
  /**
   * Hard ceiling on total spend across the life of this provider instance, enforced
   * client-side before any request leaves the process. Not a substitute for the account-level
   * spend cap in the Anthropic Console — that is the real ceiling — but a second, local one
   * that fails fast during development rather than relying on a person to remember to check
   * the Console after every test run.
   */
  readonly maxTotalSpendUsd?: number;
}

export class SpendLimitExceededError extends Error {
  readonly spentUsd: number;
  readonly limitUsd: number;

  constructor(spentUsd: number, limitUsd: number) {
    super(
      `This provider instance has spent $${spentUsd.toFixed(4)} against a $${limitUsd.toFixed(2)} ` +
        `limit and refuses to send another request. Raise maxTotalSpendUsd explicitly if this is ` +
        `deliberate.`,
    );
    this.name = "SpendLimitExceededError";
    this.spentUsd = spentUsd;
    this.limitUsd = limitUsd;
  }
}

export class AnthropicProvider implements Provider {
  readonly id = "anthropic";
  private readonly client: Anthropic;
  private readonly maxTotalSpendUsd: number;
  private spentUsd = 0;

  constructor(options: AnthropicProviderOptions = {}) {
    // Anthropic() with no key resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an active
    // `ant auth login` profile in that order — never pass an empty string, which would shadow a
    // working profile with an explicit non-credential.
    this.client = options.apiKey ? new Anthropic({ apiKey: options.apiKey }) : new Anthropic();
    // Defaults to one cent. This adapter is new and untested against a live account; the
    // default should make it structurally difficult to spend real money by accident, and
    // callers who mean to spend more say so explicitly.
    this.maxTotalSpendUsd = options.maxTotalSpendUsd ?? 0.01;
  }

  capabilities(model: string): ModelCapabilities {
    const found = CAPABILITIES[model];
    if (!found) {
      throw new Error(
        `No capability profile for model "${model}". Add one to CAPABILITIES after checking ` +
          `the current context window, pricing and feature support for it — never guess.`,
      );
    }
    return found;
  }

  estimateInputTokens(request: GenerationRequest): number {
    // A real pre-flight count via client.messages.countTokens would cost a request of its own;
    // this stays a rough local estimate, used only for the gateway's budget check before
    // anything is sent (packages/ai/src/task.ts). The actual, billed count always comes back on
    // response.usage and is what usage tracking and the spend limit use.
    let total = 0;
    for (const part of request.parts) {
      if (part.type === "text") total += Math.ceil(part.text.length / 4);
      // A PDF is billed per page (text + image — see PDF_TOKENS_PER_PAGE). The previous flat
      // 1,600 per part let a 40-page PDF through a 30K budget as if it were one page (D-051).
      else if (part.type === "pdf") total += part.pages * PDF_TOKENS_PER_PAGE;
      else total += 1_600; // one image, roughly, per Anthropic's own vision-token guidance
    }
    return total + Math.ceil(request.system.length / 4);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const capabilities = this.capabilities(request.model);

    if (this.spentUsd >= this.maxTotalSpendUsd) {
      throw new SpendLimitExceededError(this.spentUsd, this.maxTotalSpendUsd);
    }

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [{ role: "user", content: toAnthropicContent(request.parts) }],
      // output_config.format, not the deprecated top-level output_format — verified current
      // shape 2026-09-19.
      output_config: { format: { type: "json_schema", schema: request.schema } },
    } as Anthropic.MessageCreateParamsNonStreaming);

    // Verified against Anthropic's prompt-caching documentation 2026-09-20: `input_tokens` is
    // ONLY the tokens after the last cache breakpoint — it already excludes both
    // `cache_read_input_tokens` and `cache_creation_input_tokens`, so none of the three is a
    // subset of another and none should be subtracted from another. The previous version of
    // this code subtracted cache reads from `input_tokens` (double-discounting them, since they
    // were never in there) and dropped cache-write tokens entirely (undercounting the 1.25x/2x
    // premium D-029 flags as "half the arithmetic"). Both were invisible in the live smoke
    // tests because neither request set `cacheable: true`.
    const usage = response.usage;
    const inputTokens = usage.input_tokens;
    const cachedInputTokens = usage.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
    const outputTokens = usage.output_tokens;

    const costUsd =
      (inputTokens / 1_000_000) * capabilities.costPerMTokInput +
      (cachedInputTokens / 1_000_000) * capabilities.costPerMTokCachedInput +
      (cacheWriteTokens / 1_000_000) * capabilities.costPerMTokCacheWrite +
      (outputTokens / 1_000_000) * capabilities.costPerMTokOutput;

    // Enforced AFTER the call, in addition to the check before it: the pre-call check catches
    // "we already know we're over"; this one is what actually stops a runaway loop, because it
    // updates the running total that the next call's pre-check reads.
    this.spentUsd += costUsd;
    if (this.spentUsd > this.maxTotalSpendUsd) {
      throw new SpendLimitExceededError(this.spentUsd, this.maxTotalSpendUsd);
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textBlock) {
      throw new Error(
        `Anthropic response for ${request.model} contained no text block — got: ` +
          response.content.map((b) => b.type).join(", "),
      );
    }

    return {
      value: JSON.parse(textBlock.text) as unknown,
      model: response.model,
      providerId: this.id,
      usage: { inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, costUsd },
    };
  }
}

function toAnthropicContent(
  parts: readonly ContentPart[],
): Anthropic.MessageParam["content"] {
  return parts.map((part) => {
    if (part.type === "text") {
      return part.cacheable
        ? { type: "text" as const, text: part.text, cache_control: { type: "ephemeral" as const } }
        : { type: "text" as const, text: part.text };
    }
    if (part.type === "pdf") {
      return {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: Buffer.from(part.bytes).toString("base64"),
        },
      };
    }
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: part.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: Buffer.from(part.bytes).toString("base64"),
      },
    };
  });
}
