/**
 * `npm run waitlist:export` — `05-interim-waitlist-plan.md` §7 and §9. Writes a CSV that:
 *   (a) MailerLite can import once the PO box exists, preserving each person's original
 *       consent date rather than re-asking them to sign up, and
 *   (b) an operator can hand-review in a spreadsheet at any point in between.
 *
 * Written to a gitignored path — this is a personal-data export and must never be committed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runD1 } from "./wrangler-d1.ts";

interface SubscriberRow {
  readonly email: string;
  readonly sku_count: string | null;
  readonly consented_at: string;
  readonly consent_text_version: string;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const rows = runD1<SubscriberRow>(
  "SELECT email, sku_count, consented_at, consent_text_version FROM subscriber ORDER BY consented_at",
);

const header = ["email", "sku_count", "consented_at", "consent_text_version"];
const lines = [
  header.join(","),
  ...rows.map((row) =>
    [row.email, row.sku_count ?? "", row.consented_at, row.consent_text_version].map(csvField).join(","),
  ),
];

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(appRoot, "exports");
const outFile = join(outDir, `waitlist-${new Date().toISOString().slice(0, 10)}.csv`);
await mkdir(outDir, { recursive: true });
await writeFile(outFile, lines.join("\n") + "\n", "utf8");

console.log(`Exported ${rows.length} subscriber(s) → ${outFile}`);
console.log(`This file contains personal data. It is gitignored — keep it that way.`);
