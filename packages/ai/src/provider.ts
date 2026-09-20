/**
 * The provider seam.
 *
 * Everything in this file is vendor-neutral by construction: no type here names Anthropic,
 * Google, OpenAI or any of their SDK shapes, and no file outside this package is permitted to
 * import a provider SDK at all (test/boundary.test.ts fails the build if one does).
 *
 * WHAT "SWAP THE PROVIDER AND IT STILL WORKS" ACTUALLY REQUIRES
 *
 * A narrow interface is necessary and not sufficient. Providers differ in ways that leak
 * through any interface unless they are modelled explicitly, so they are modelled explicitly,
 * in `ModelCapabilities`:
 *
 *   - context window (Haiku-class models are far smaller than the frontier ones)
 *   - whether a PDF can be sent as a document, or has to be rendered to images first
 *   - how a structured result is obtained: a native response format, a tool call, or a prompt
 *     plus a validator
 *   - whether there is a batch tier, and whether a stable prefix is cached
 *   - price, which the router needs in order to be a router
 *
 * The gateway adapts the request to whatever the chosen provider declares. That is what makes
 * a swap a configuration change rather than a rewrite.
 *
 * What a swap does NOT preserve for free is extraction *quality*. A different model reads a
 * scanned Chinese test report differently, and no abstraction can hide that. The golden-set
 * eval is the gate for a provider change, exactly as it is for a prompt change — which is why
 * the second adapter is scheduled for the week the eval can score it (decisions.md D-014).
 */

export interface ModelCapabilities {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  /** Can a PDF be sent as-is, or must pages be rendered to images first? */
  readonly acceptsPdf: boolean;
  readonly acceptsImages: boolean;
  /** How a schema-valid result is obtained from this model. */
  readonly structuredOutput: "native" | "tool" | "prompted";
  readonly supportsBatch: boolean;
  readonly supportsPromptCache: boolean;
  readonly costPerMTokInput: number;
  readonly costPerMTokOutput: number;
  /** Cache reads are cheaper than fresh input on every provider that has them. */
  readonly costPerMTokCachedInput: number;
  /**
   * Writing a cache entry costs MORE than an uncached request, which is the half of prompt
   * caching that "reads are 10% of input" leaves out. Verified against Anthropic's own
   * documentation on 13 September 2026: 1.25x at the short TTL, 2x at the long one.
   *
   * It matters here because our cacheable prefix is a long extraction schema reused across many
   * documents — a pattern where caching wins easily, but only above the break-even below. A
   * customer who uploads one document a month may never reach it.
   */
  readonly costPerMTokCacheWrite: number;
  /**
   * Whether this model accepts a pinned inference geography. Not universal even within one
   * vendor: on Anthropic this needs Claude 4.6 or later, and Haiku 4.5 — the model the technical
   * plan routes classification to — returns a 400.
   */
  readonly supportsGeoPinning: boolean;
}

/**
 * How many cache reads are needed before caching a prefix is cheaper than not caching it.
 *
 * write + n x read  <  (n + 1) x input
 *
 * Worth computing rather than assuming: at Anthropic's 1.25x write and 0.1x read, the answer is
 * a fraction over one read, so caching pays almost immediately. At a 2x write it is nearer three.
 * A provider with a more expensive write could make caching a loss for our access pattern, and
 * the gateway should be able to tell rather than believe.
 */
export function cacheBreakEvenReads(capabilities: ModelCapabilities): number {
  const { costPerMTokInput: input, costPerMTokCachedInput: read, costPerMTokCacheWrite: write } = capabilities;
  if (read >= input) return Number.POSITIVE_INFINITY;
  return Math.ceil((write - input) / (input - read));
}

export type ContentPart =
  | { readonly type: "text"; readonly text: string; readonly cacheable?: boolean }
  | { readonly type: "pdf"; readonly bytes: Uint8Array; readonly pages: number }
  | { readonly type: "image"; readonly bytes: Uint8Array; readonly mime: string };

export interface GenerationRequest {
  /** A key into configuration. Never a literal model id in feature code. */
  readonly model: string;
  readonly system: string;
  readonly parts: readonly ContentPart[];
  /** JSON Schema the result must satisfy. The gateway validates, whatever the provider did. */
  readonly schema: Readonly<Record<string, unknown>>;
  readonly maxOutputTokens: number;
  readonly batch?: boolean;
}

export interface Usage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

export interface GenerationResult {
  readonly value: unknown;
  readonly usage: Usage;
  readonly model: string;
  readonly providerId: string;
}

export interface Provider {
  readonly id: string;
  capabilities(model: string): ModelCapabilities;
  /** Provider-native token count where available; a documented estimate otherwise. */
  estimateInputTokens(request: GenerationRequest): number;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

/** Rough, provider-neutral estimate used before a request is sent, to enforce budgets. */
export function estimateTokens(parts: readonly ContentPart[], imageTokensPerPage: number): number {
  let total = 0;
  for (const part of parts) {
    if (part.type === "text") total += Math.ceil(part.text.length / 4);
    else if (part.type === "pdf") total += part.pages * imageTokensPerPage;
    else total += imageTokensPerPage;
  }
  return total;
}
