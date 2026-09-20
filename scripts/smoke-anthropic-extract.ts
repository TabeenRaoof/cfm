/**
 * The second script permitted to spend real money — same safety model as smoke-anthropic.ts,
 * exercising extract_document instead of classify_document.
 *
 * What it does: extracts an RP mandate through the same Gateway the product uses, with a text
 * that deliberately leaves the free-text fields (rp_name, rp_address, manufacturer_name) for the
 * model — @cfm/documents' patterns only cover issue_date here — so the deterministic pass
 * genuinely narrows the schema rather than answering outright, and the model is exercised on a
 * request whose schema was already shrunk before it was sent.
 *
 * SAFETY, same three layers as smoke-anthropic.ts:
 *   1. --confirm required on the command line.
 *   2. maxTotalSpendUsd on the provider (set below to $0.05 — extraction's schema is bigger
 *      than classification's, so the estimate is a little more headroom, not a different order
 *      of magnitude).
 *   3. The task's own token budget (packages/ai/src/tasks/extract-document.ts).
 *
 *   npm run smoke:anthropic:extract -- --confirm
 */

import { extractDocument, Gateway } from "@cfm/ai";
import type { UsageRecord, UsageSink } from "@cfm/ai";
import { AnthropicProvider } from "../packages/ai/src/providers/anthropic.ts";

class PrintingUsageSink implements UsageSink {
  readonly entries: UsageRecord[] = [];
  record(entry: UsageRecord): void {
    this.entries.push(entry);
  }
  get totalCostUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
  }
}

const CONFIRMED = process.argv.includes("--confirm");
const MAX_SPEND_USD = 0.05;

if (!CONFIRMED) {
  console.log(`This makes one real, billed call to the Anthropic API using Claude Haiku 4.5,
running the extract_document task against a synthetic RP mandate.

Estimated cost: well under $0.01.
Hard cap for this run: $${MAX_SPEND_USD.toFixed(2)} (the provider refuses anything past it).

Nothing has been sent. Re-run with --confirm to actually send the request:

  npm run smoke:anthropic:extract -- --confirm
`);
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is empty in .env.local. Open it at the repo root and paste a real key in.");
  process.exit(1);
}

const usage = new PrintingUsageSink();
const gateway = new Gateway({
  provider: new AnthropicProvider({ maxTotalSpendUsd: MAX_SPEND_USD }),
  models: { extract: "claude-haiku-4-5" },
  usage,
  imageTokensPerPage: 1_600,
});

// issue_date is labelled plainly, so @cfm/documents resolves it for free. rp_name, rp_address,
// rp_country and manufacturer_name are required but have no pattern at all — the deterministic
// pass cannot touch them, so the model is asked for exactly those, and only those.
const RP_MANDATE_TEXT = `
  MANDATE OF APPOINTMENT

  Nordholt Trading GmbH, of Speicherstrasse 12, 20457 Hamburg, Germany, hereby appoints
  Compliance Bridge Ltd, 4 Fenwick Court, London EC2A 3JR, United Kingdom, to act as its
  responsible person under Regulation (EU) 2023/988 for the products listed in Annex A.

  Signed on: 03.02.2026
`;

console.log("Sending one extraction request to claude-haiku-4-5...\n");

const outcome = await gateway.runTask(extractDocument, {
  documentType: "rp_mandate",
  textLayer: RP_MANDATE_TEXT,
  pages: [],
});

console.log(`Values: ${JSON.stringify(outcome.value.values, null, 2)}`);
console.log(`Resolved without a model call: ${outcome.resolvedWithoutModel}`);
console.log(`Fields omitted from the model request: ${outcome.omitted.join("; ") || "(none)"}`);
console.log(`\nUsage this run:`);
for (const entry of usage.entries) {
  console.log(
    `  ${entry.taskId}: ${entry.inputTokens} in / ${entry.outputTokens} out, ` +
      `$${entry.costUsd.toFixed(6)} (${entry.providerId}/${entry.model})`,
  );
}
console.log(`\nTotal spent this run: $${usage.totalCostUsd.toFixed(6)} of a $${MAX_SPEND_USD.toFixed(2)} cap.`);
