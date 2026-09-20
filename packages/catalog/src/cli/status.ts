/**
 * What is published, what is drafted, and what has a review packet waiting. One screen, so the
 * question "what should I do with this hour" has an answer that does not require reading files.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Requirement } from "../types.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requirementsDir = join(packageRoot, "requirements");

const packets = new Set(
  (await readdir(join(packageRoot, "review")))
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => n.replace(/\.md$/, "")),
);

const files = (await readdir(requirementsDir)).filter((n) => n.endsWith(".json")).sort();
const requirements = await Promise.all(
  files.map(async (n) => JSON.parse(await readFile(join(requirementsDir, n), "utf8")) as Requirement),
);

const published = requirements.filter((r) => r.state === "published");
const drafts = requirements.filter((r) => r.state === "draft");

console.log(`\n  ${published.length} published · ${drafts.length} draft\n`);

if (published.length > 0) {
  console.log("  PUBLISHED");
  for (const r of published) {
    console.log(`    ${pad(r.confidence, 6)} ${pad(r.reviewer ?? "?", 4)} ${r.last_reviewed_at}  ${r.id}`);
  }
  console.log();
}

console.log("  DRAFT");
for (const r of drafts) {
  const packet = packets.has(r.id) ? "packet" : "      ";
  console.log(`    ${pad(r.confidence, 6)} ${packet}  ${r.id}`);
}

const ready = drafts.filter((r) => packets.has(r.id));
if (ready.length > 0) {
  console.log(`\n  ${ready.length} draft(s) have a review packet — read the packet, open the source, then:`);
  console.log(`    npm run catalog:publish -- ${ready[0]?.id} --reviewer XX --confidence high --read 0`);
}

if (published.length === 0) {
  console.log(`\n  Nothing is published, so a production scanner build will refuse.`);
}
console.log();

function pad(value: string, width: number): string {
  return value.padEnd(width);
}
