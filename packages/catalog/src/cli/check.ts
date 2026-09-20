/**
 * CI gate for the catalog. Validates every requirement file and reports what is fit to
 * publish. Exits non-zero on any validation issue, so a malformed or uncited requirement
 * cannot reach main.
 *
 * Runs on a bare Node with no install — the package has no dependencies on purpose.
 *   node --experimental-strip-types src/cli/check.ts
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalogFromDir } from "../node.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(await readFile(join(packageRoot, "catalog.json"), "utf8")) as {
  version: string;
};

const { catalog, issues, withheldDrafts } = await loadCatalogFromDir(
  join(packageRoot, "requirements"),
  { version: manifest.version, includeDrafts: false },
);

for (const issue of issues) {
  console.error(`${issue.file}: ${issue.path} — ${issue.message}`);
}

console.log(`catalog ${catalog.version}`);
console.log(`  published : ${catalog.requirements.length}`);
console.log(`  drafts    : ${withheldDrafts.length} (withheld from the live catalog)`);
for (const id of withheldDrafts) console.log(`              - ${id}`);
console.log(`  issues    : ${issues.length}`);

if (issues.length > 0) {
  console.error("\nCatalog check failed.");
  process.exit(1);
}

if (catalog.requirements.length === 0) {
  console.log(
    "\nNo requirement is published yet. Every entry is a draft awaiting review against its\n" +
      "primary source — see decisions.md D-008. This is the expected state until Tabeen has\n" +
      "read the sources and set state, reviewer and last_reviewed_at.",
  );
}
