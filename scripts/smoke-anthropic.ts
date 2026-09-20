/**
 * One of two scripts in this repo permitted to spend real money (the other is
 * scripts/smoke-anthropic-extract.ts). Run either manually, never in CI, never as part of
 * `npm run smoke` (which stays free by design — see decisions.md D-019).
 *
 * What it does: classifies one short, made-up document with Claude Haiku 4.5, through the same
 * Gateway and the same classify_document task the product uses — so this proves the adapter
 * works end to end, not just that the SDK can be imported.
 *
 * SAFETY, in three independent layers, so no single mistake spends more than the operator meant:
 *   1. --confirm is required on the command line. Running the script bare explains itself and
 *      does nothing.
 *   2. maxTotalSpendUsd on the provider (default one cent) refuses any call that would exceed
 *      it — checked before AND after the request, so a runaway loop cannot spend past it.
 *   3. The task's own token budget (packages/ai/src/tasks/classify-document.ts) caps what a
 *      single call can even ask for, independent of what the provider allows.
 *
 * Before running: open .env.local (created empty at the repo root, gitignored — see
 * tabeen_AGENTS.md "Never commit") and paste a real key into ANTHROPIC_API_KEY=. The npm
 * script loads it automatically via --env-file-if-exists, so nothing else is needed. The real
 * ceiling that matters is the spend cap set in the Anthropic Console (Settings > Billing) —
 * this script's cap is a second, local one for catching a mistake during development, not a
 * substitute for that.
 *
 *   npm run smoke:anthropic -- --confirm
 */

import { classifyDocument, Gateway } from "@cfm/ai";
import type { UsageRecord, UsageSink } from "@cfm/ai";
import { AnthropicProvider } from "../packages/ai/src/providers/anthropic.ts";

// A minimal sink, written here rather than imported: RecordingUsageSink in @cfm/ai's fake.ts is
// a test fixture and deliberately not re-exported for scripts to depend on.
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
const MAX_SPEND_USD = 1.0; // matches the cap Tabeen set for this session's testing.

if (!CONFIRMED) {
  console.log(`This makes one real, billed call to the Anthropic API using Claude Haiku 4.5.

Estimated cost: well under $0.01 for the tiny document below.
Hard cap for this run: $${MAX_SPEND_USD.toFixed(2)} (the provider refuses anything past it).

Nothing has been sent. Re-run with --confirm to actually send the request:

  npm run smoke:anthropic -- --confirm
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
  models: { classify: "claude-haiku-4-5" },
  usage,
});

// Deliberately ambiguous — two document types match ("test report" AND "declaration of
// conformity" both appear) — so the deterministic pass in @cfm/documents escalates rather than
// answering for free, and the model is genuinely exercised rather than short-circuited.
const AMBIGUOUS_TEXT = `
  SGS TESTING SERVICES
  TEST REPORT No. TR-2026-0091

  EU DECLARATION OF CONFORMITY
  We declare under our sole responsibility that the product identified above is in conformity
  with the essential safety requirements of the applicable EU legislation.
`;

console.log("Sending one classification request to claude-haiku-4-5...\n");

const outcome = await gateway.runTask(classifyDocument, {
  filename: "ambiguous-sample.pdf",
  textLayer: AMBIGUOUS_TEXT,
  firstPages: [],
});

console.log(`Result: ${JSON.stringify(outcome.value)}`);
console.log(`Resolved without a model call: ${outcome.resolvedWithoutModel}`);
console.log(`\nUsage this run:`);
for (const entry of usage.entries) {
  console.log(
    `  ${entry.taskId}: ${entry.inputTokens} in / ${entry.outputTokens} out, ` +
      `$${entry.costUsd.toFixed(6)} (${entry.providerId}/${entry.model})`,
  );
}
console.log(`\nTotal spent this run: $${usage.totalCostUsd.toFixed(6)} of a $${MAX_SPEND_USD.toFixed(2)} cap.`);
