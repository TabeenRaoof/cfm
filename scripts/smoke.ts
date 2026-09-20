/**
 * Runs the deterministic path end to end on a bare `node`, with no build and no install of
 * anything beyond the workspace links.
 *
 * This exists because "it runs with no build step" is a claim that decays silently: a single
 * TypeScript parameter property or enum anywhere in the chain breaks it, and nothing else in
 * CI would notice. `erasableSyntaxOnly` in tsconfig catches most of it at typecheck; this
 * catches the rest by actually doing it.
 */

import { loadCatalogFromDir } from "@cfm/catalog/node";
import { assessProduct } from "@cfm/catalog";
import { scan } from "@cfm/scanner";
import { renderTechnicalFile } from "@cfm/techfile";

const { catalog, issues } = await loadCatalogFromDir("packages/catalog/requirements", {
  version: "2026.09.0",
  includeDrafts: true,
});
if (issues.length > 0) throw new Error(`catalog has ${issues.length} validation issues`);

const csv = [
  "SKU,Title,Country of Origin,Contains Battery,Packaging,Warehouse Bin",
  "TOY-001,Wooden train,China,no,yes,B12",
  "TOY-002,Remote car,China,,yes,B13",
  "TOY-003,Puzzle,Germany,no,yes,B14",
].join("\n");

const report = scan(csv, {
  catalog,
  markets: ["DE", "FR"],
  channel: "amazon_de",
  asOf: "2026-09-12",
  maxRows: 500,
});

console.log(
  `${report.skusScanned} SKUs x ${report.markets.join(", ")} — ` +
    `ready ${report.skusReady} | blocked ${report.skusBlocked} | undecidable ${report.skusUndecidable}\n`,
);
console.log("Tell us these and we can decide more:");
for (const q of report.questions) {
  console.log(`   ${String(q.unblocks).padStart(2)} cells  <-  ${q.factPath}`);
}
console.log(`\n  unrecognised columns : ${report.diagnostics.unmapped.join(", ") || "none"}`);
console.log(
  `  columns not provided : ${report.diagnostics.absentFacts.slice(0, 3).map((f) => f.label).join(", ")} …\n`,
);
for (const product of report.products) {
  const de = product.markets[0];
  console.log(`  ${product.sku}  DE: ${de?.blocking.length} outstanding, ${de?.unresolved.length} undecidable`);
}

if (report.skusScanned !== 3) throw new Error("smoke test did not scan the expected rows");

// The technical file is `02-` §15.4's bar for 12 December, so it runs here too.
const technicalFile = renderTechnicalFile({
  sku: "TOY-002",
  title: "Remote control car",
  organisationName: "Example Brands Ltd",
  generatedAt: "2026-09-13",
  assessment: assessProduct(
    catalog,
    {
      facts: { "manufacturer.country": "CN", "product.has_packaging": true, "product.is_toy": true },
      market: { iso_country: "DE" },
      channel: { type: "amazon_de" },
    },
    { asOf: "2026-09-13" },
  ),
});

if (!technicalFile.includes("Could not be determined")) {
  throw new Error("the technical file dropped its undetermined section");
}
if (/is compliant|certified|guarantee/i.test(technicalFile)) {
  throw new Error("the technical file made a claim it is not entitled to make");
}
console.log(`\n  technical file: ${(technicalFile.length / 1024).toFixed(1)} KB, self-contained \u2713`);
