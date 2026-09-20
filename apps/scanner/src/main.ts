/**
 * The public scanner, running entirely in the visitor's browser.
 *
 * There is no server in this path and there must not be one. The seller's spreadsheet is read
 * with FileReader, evaluated against a catalog slice fetched as a static JSON file, and
 * rendered — nothing is posted anywhere. That is what makes the privacy claim on the page true
 * rather than aspirational, and it is why this page cannot be made to spend money
 * (decisions.md D-009, D-013, D-020).
 *
 * If a future change adds a fetch that sends any part of the file, the claim in the hero has
 * to come out of the HTML in the same commit.
 */

import type { Catalog } from "@cfm/catalog";
import { CsvTooLargeError } from "@cfm/import";
import type { ScanReport } from "@cfm/scanner";
import { scan } from "@cfm/scanner";

declare const __DRAFT_BUILD__: boolean;

const MAX_ROWS = 500;
const MAX_ROWS_SHOWN = 200;

/** Catalog slices are fetched per market and cached for the session. */
const sliceCache = new Map<string, Catalog>();

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

const fileInput = el<HTMLInputElement>("file");
const drop = el<HTMLDivElement>("drop");
const channelSelect = el<HTMLSelectElement>("channel");
const results = el<HTMLElement>("results");
const errorBox = el<HTMLParagraphElement>("error");

function selectedMarkets(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[name="market"]:checked')].map(
    (input) => input.value,
  );
}

async function loadSlice(iso: string): Promise<Catalog> {
  const cached = sliceCache.get(iso);
  if (cached) return cached;

  const response = await fetch(`catalog/${iso}.json`);
  if (!response.ok) throw new Error(`Could not load the requirements for ${iso}.`);
  const slice = (await response.json()) as Catalog;
  sliceCache.set(iso, slice);
  return slice;
}

/**
 * Merge the per-market slices into one catalog for the scan. Slices overlap heavily — every
 * EU market shares the GPSR requirements — so they are deduplicated by id. Merging is safe
 * precisely because a slice only ever omits requirements that could not apply in its own
 * market, and the evaluator re-checks applicability per market anyway.
 */
function mergeSlices(slices: readonly Catalog[]): Catalog {
  const byId = new Map<string, Catalog["requirements"][number]>();
  for (const slice of slices) for (const r of slice.requirements) byId.set(r.id, r);
  return { version: slices[0]?.version ?? "unknown", requirements: [...byId.values()] };
}

async function runScan(csvText: string): Promise<void> {
  const markets = selectedMarkets();
  if (markets.length === 0) {
    showError("Choose at least one market first.");
    return;
  }

  const slices = await Promise.all(markets.map(loadSlice));
  const channel = channelSelect.value;

  const report = scan(csvText, {
    catalog: mergeSlices(slices),
    markets,
    asOf: new Date().toISOString().slice(0, 10),
    maxRows: MAX_ROWS,
    ...(channel ? { channel } : {}),
  });

  render(report);
}

function render(report: ScanReport): void {
  renderSummary(report);
  renderQuestions(report);
  renderDiagnostics(report);
  renderTable(report);

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSummary(report: ScanReport): void {
  const cells = [
    { value: report.skusScanned, label: "SKUs checked", tone: "" },
    { value: report.skusBlocked, label: "with something outstanding", tone: "bad" },
    { value: report.skusUndecidable, label: "we cannot decide yet", tone: "unknown" },
    { value: report.skusReady, label: "nothing outstanding", tone: "ok" },
  ];
  el("summary").replaceChildren(
    ...cells.map(({ value, label, tone }) => {
      const div = document.createElement("div");
      div.className = `stat ${tone}`.trim();
      const b = document.createElement("b");
      b.textContent = String(value);
      const span = document.createElement("span");
      span.textContent = label;
      div.append(b, span);
      return div;
    }),
  );
}

function renderQuestions(report: ScanReport): void {
  const block = el("questions-block");
  block.hidden = report.questions.length === 0;

  el("questions").replaceChildren(
    ...report.questions.map((question) => {
      const li = document.createElement("li");
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = `${question.unblocks}×`;
      const text = document.createElement("span");
      text.textContent = describeFact(question.factPath);
      li.append(count, text);
      return li;
    }),
  );
}

function renderDiagnostics(report: ScanReport): void {
  const notes: string[] = [];
  const { unmapped, absentFacts, duplicateSkus, warnings } = report.diagnostics;

  if (unmapped.length > 0) {
    notes.push(`Columns we did not recognise, and ignored: ${unmapped.join(", ")}.`);
  }
  if (absentFacts.length > 0) {
    notes.push(
      `Your file has no column for: ${absentFacts.map((f) => f.label).join(", ")}. ` +
        `Adding them would resolve some of the undecidable rows above.`,
    );
  }
  if (duplicateSkus.length > 0) {
    notes.push(`SKUs appearing more than once: ${duplicateSkus.slice(0, 10).join(", ")}.`);
  }
  for (const warning of warnings.slice(0, 5)) {
    notes.push(`Row ${warning.row}, ${warning.column}: ${warning.message}`);
  }
  if (warnings.length > 5) notes.push(`…and ${warnings.length - 5} more cell warnings.`);

  const block = el("diagnostics-block");
  block.hidden = notes.length === 0;
  el("diagnostics").replaceChildren(
    ...notes.map((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      return li;
    }),
  );
}

function renderTable(report: ScanReport): void {
  const body = el<HTMLTableSectionElement>("table").querySelector("tbody");
  if (!body) return;

  const rows: HTMLTableRowElement[] = [];
  for (const product of report.products.slice(0, MAX_ROWS_SHOWN)) {
    for (const market of product.markets) {
      const tr = document.createElement("tr");
      tr.append(
        cell(product.sku ?? `row ${product.row}`),
        cell(market.market),
        pillCell(market.blocking.length, "bad"),
        pillCell(market.unresolved.length, "unknown"),
      );
      rows.push(tr);
    }
  }
  body.replaceChildren(...rows);

  const truncation = el("truncation");
  const shown = Math.min(report.products.length, MAX_ROWS_SHOWN);
  truncation.hidden = report.products.length <= MAX_ROWS_SHOWN;
  truncation.textContent = `Showing the first ${shown} of ${report.products.length} SKUs.`;
}

function cell(text: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function pillCell(count: number, tone: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "num";
  const span = document.createElement("span");
  span.className = `pill ${count === 0 ? "zero" : tone}`;
  span.textContent = String(count);
  td.append(span);
  return td;
}

/**
 * Fact paths are internal identifiers. A seller should read a question, not a schema key —
 * and an unlabelled path here would be the tool telling them "product.has_packaging" as if
 * that were a sentence.
 */
const FACT_LABELS: Readonly<Record<string, string>> = {
  "manufacturer.country": "Where is each product manufactured?",
  "organisation.establishment_country": "Which country is your business established in?",
  "product.has_packaging": "Which products ship in packaging?",
  "product.has_battery": "Which products contain a battery?",
  "product.is_toy": "Which products are toys?",
  "product.is_electrical": "Which products are electrical?",
  "channel.type": "Which sales channel are you selling through?",
  "product.gtin": "What is each product's barcode?",
};

function describeFact(factPath: string): string {
  return FACT_LABELS[factPath] ?? `We need to know: ${factPath}`;
}

function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError(): void {
  errorBox.hidden = true;
}

async function handleFile(file: File): Promise<void> {
  clearError();
  try {
    const text = await file.text();
    await runScan(text);
  } catch (cause) {
    if (cause instanceof CsvTooLargeError) {
      showError(
        `That file has more than ${cause.maxRows} rows. This free check is limited to ` +
          `${cause.maxRows}; split the file, or get in touch about the full product.`,
      );
      return;
    }
    showError(cause instanceof Error ? cause.message : "Something went wrong reading that file.");
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

drop.addEventListener("click", (event) => {
  if (event.target !== fileInput) fileInput.click();
});
drop.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

el("sample").addEventListener("click", () => {
  void handleFile(
    new File([SAMPLE_CSV], "sample.csv", { type: "text/csv" }),
  );
});

/** Deliberately imperfect: a blank battery cell and an unrecognised column, so the sample
 *  demonstrates what the tool does about incomplete data rather than a tidy best case. */
const SAMPLE_CSV = [
  "SKU,Title,Country of Origin,Contains Battery,Packaging,Warehouse Bin",
  "TOY-001,Wooden train set,China,no,yes,B12",
  "TOY-002,Remote control car,China,,yes,B13",
  "TOY-003,Jigsaw puzzle 500pc,Germany,no,yes,B14",
  "HOME-011,Ceramic mug,Portugal,no,yes,A02",
  "ELEC-204,Desk lamp,Vietnam,no,yes,C31",
].join("\n");

if (typeof __DRAFT_BUILD__ !== "undefined" && __DRAFT_BUILD__) {
  console.warn("Draft catalog build — requirements are not reviewed. Not for production.");
}
