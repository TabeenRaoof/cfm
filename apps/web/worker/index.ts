/** Production entry: Anthropic behind the gateway, a hard spend cap per document (D-051). */

import { AnthropicProvider } from "@cfm/ai/providers/anthropic";
import { createWorker } from "./app.ts";

/**
 * Per-document ceiling, enforced client-side by the adapter before and after the call — a second
 * line behind extract_document's token budget and the account-level cap in the Anthropic Console.
 * A 1–3 page mandate or certificate costs well under a cent; this only stops a runaway.
 */
const MAX_SPEND_PER_DOCUMENT_USD = 0.1;

export default createWorker((env) => {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set for this Worker.");
  return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, maxTotalSpendUsd: MAX_SPEND_PER_DOCUMENT_USD });
});
