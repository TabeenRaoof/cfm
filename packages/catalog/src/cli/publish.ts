/**
 * Publish a reviewed requirement.
 *
 * D-008 says only a named human may publish, and that stays true: this command does not decide
 * anything. It records a decision you have already made, by writing the five fields you would
 * otherwise edit by hand, and it refuses to run unless you state who you are, what confidence
 * you reached, and which source you actually opened.
 *
 * The point is that the judgement should cost your attention and the bookkeeping should cost
 * nothing — at 2-3 hrs/week, five hand-edits per requirement is where review quietly stops
 * happening (playbook Lesson 21: automate what is computable, so the checklist is only the
 * fallback).
 *
 *   npm run catalog:publish -- eu.gpsr.technical-documentation \
 *     --reviewer TR --confidence high --read 0
 */

import { appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRequirement } from "../validate.ts";
import type { Requirement } from "../types.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const reviewer = flag("reviewer");
const confidence = flag("confidence");
const readIndex = flag("read");

if (!id || !reviewer || !confidence || readIndex === undefined) {
  console.error(`Publish a reviewed requirement.

  npm run catalog:publish -- <requirement-id> --reviewer <initials> --confidence <high|medium|low> --read <source-index>

  --reviewer    Your initials. Goes in the file and is shown to customers.
  --confidence  high   you read the source and it is unambiguous
                medium you read it and mapping it to our wording took judgement
                low    do not publish yet
  --read        Index of the source you actually opened (usually 0). This is you asserting
                you read it; nothing else sets verified: true.

Nothing is published without all four.`);
  process.exit(1);
}

if (!["high", "medium", "low"].includes(confidence)) {
  console.error(`--confidence must be high, medium or low (got "${confidence}").`);
  process.exit(1);
}
if (confidence === "low") {
  console.error(
    `Refusing: confidence "low" means the requirement is not ready for customers. Leave it a\n` +
      `draft and come back to it, or raise your confidence by reading further.`,
  );
  process.exit(1);
}

const file = join(packageRoot, "requirements", `${id}.json`);
let requirement: Requirement;
try {
  requirement = JSON.parse(await readFile(file, "utf8")) as Requirement;
} catch {
  console.error(`No requirement file at requirements/${id}.json`);
  process.exit(1);
}

const sourceIndex = Number(readIndex);
const source = requirement.sources[sourceIndex];
if (!source) {
  console.error(`No source at index ${sourceIndex}. This requirement has ${requirement.sources.length}:`);
  requirement.sources.forEach((s, i) => console.error(`  ${i}  ${s.title}\n     ${s.url}`));
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const published: Requirement = {
  ...requirement,
  state: "published",
  reviewer,
  last_reviewed_at: today,
  confidence: confidence as Requirement["confidence"],
  sources: requirement.sources.map((s, i) =>
    i === sourceIndex ? { ...s, verified: true, retrieved_at: today } : s,
  ),
};

// The same gate CI runs. Publishing locally must not be able to produce something the build
// would reject.
const issues = validateRequirement(published, `${id}.json`);
if (issues.length > 0) {
  console.error("Refusing — the result would not pass the catalog gate:");
  for (const issue of issues) console.error(`  ${issue.path}: ${issue.message}`);
  process.exit(1);
}

await writeFile(file, `${JSON.stringify(published, null, 2)}\n`);

// sources.md is the retrieval log, and appending to it by hand is exactly the step that gets
// skipped when a week is busy.
await appendFile(
  join(packageRoot, "sources.md"),
  `\n| ${today} | \`${id}\` | [${source.title}](${source.url}) | ${reviewer} | Published at confidence ${confidence}. |\n`,
);

console.log(`published ${id}`);
console.log(`  reviewer      ${reviewer}`);
console.log(`  reviewed      ${today}`);
console.log(`  confidence    ${confidence}`);
console.log(`  source read   ${source.title}`);
console.log(`                ${source.url}`);
console.log(`\n  logged in packages/catalog/sources.md`);
console.log(`  run \`npm run catalog:check\` to see the catalog, or \`npm run scanner:build\` to ship it.`);
