import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadCatalogFromDir } from "@cfm/catalog/node";
import { CsvTooLargeError } from "@cfm/import";
import { scan } from "../src/scan.ts";

const catalogRoot = new URL("../../catalog/", import.meta.url).pathname;
const manifest = JSON.parse(await readFile(join(catalogRoot, "catalog.json"), "utf8")) as { version: string };
const { catalog } = await loadCatalogFromDir(join(catalogRoot, "requirements"), {
  version: manifest.version,
  includeDrafts: true,
});

const run = (csv: string, markets = ["DE"], channel: string | null = "amazon_de") =>
  scan(csv, { catalog, markets, asOf: "2026-09-12", maxRows: 1000, ...(channel ? { channel } : {}) });

describe("a typical seller export", () => {
  const csv = [
    "SKU,Title,Country of Origin,Contains Battery,Packaging,Responsible Person",
    "TOY-001,Wooden train,China,no,yes,Example EU Rep GmbH",
    "TOY-002,Remote car,China,yes,yes,Example EU Rep GmbH",
    "TOY-003,Puzzle,Germany,no,yes,",
  ].join("\n");

  const report = run(csv);

  it("scans every row", () => {
    expect(report.skusScanned).toBe(3);
  });

  it("finds nothing market-ready on a spreadsheet alone", () => {
    // Documents are what close most of these, and the scanner has none.
    expect(report.skusReady).toBe(0);
  });

  it("records which catalog version produced the answer", () => {
    expect(report.catalogVersion).toBe(catalog.version);
  });

  it("does not ask for the EU responsible person when the maker is in the EU", () => {
    const puzzle = report.products.find((p) => p.sku === "TOY-003");
    const rp = puzzle?.markets[0]?.blocking.find(
      (a) => a.requirement_id === "eu.gpsr.responsible-economic-operator",
    );
    expect(rp).toBeUndefined();
  });

  it("does ask when the maker is outside it", () => {
    const train = report.products.find((p) => p.sku === "TOY-001");
    const ids = train?.markets[0]?.blocking.map((a) => a.requirement_id) ?? [];
    expect(ids).toContain("eu.gpsr.responsible-economic-operator");
  });
});

describe("a column the seller did not provide", () => {
  // The end-to-end proof of the hard rule: a missing column has to survive the CSV reader, the
  // coercion layer and the evaluator still meaning "we do not know".
  const csv = "SKU,Country of Origin,Packaging\nTOY-001,China,yes\n";
  const report = run(csv);
  const cells = report.products[0]!.markets[0]!;

  it("becomes an unresolved cell rather than a silent pass", () => {
    const toy = cells.unresolved.find((a) => a.requirement_id === "eu.flag.toy-safety");
    expect(toy?.status).toBe("unknown");
    expect(toy?.missing_facts).toEqual(["product.is_toy"]);
  });

  it("keeps the SKU out of ready", () => {
    expect(cells.ready).toBe(false);
    expect(report.skusReady).toBe(0);
  });

  it("turns into a question ranked by how much it would unblock", () => {
    expect(report.questions.map((q) => q.factPath)).toContain("product.is_toy");
    const counts = report.questions.map((q) => q.unblocks);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("is reported as an absent column the seller can fix", () => {
    expect(report.diagnostics.absentFacts.map((f) => f.factPath)).toContain("product.is_toy");
  });
});

describe("a blank cell in a column that does exist", () => {
  it("is unknown, not no", () => {
    // The seller filled in the rows that do have batteries and left the rest empty. That is
    // indistinguishable from an export with no battery data, so both get asked about.
    const report = run("SKU,Country of Origin,Contains Battery\nTOY-001,China,\n");
    const battery = report.products[0]!.markets[0]!.unresolved.find(
      (a) => a.requirement_id === "eu.flag.battery-registration",
    );
    expect(battery?.status).toBe("unknown");
  });
});

describe("several markets at once", () => {
  const report = run("SKU,Country of Origin,Packaging\nA1,China,yes\n", ["DE", "FR"]);

  it("assesses each one separately", () => {
    expect(report.products[0]?.markets.map((m) => m.market)).toEqual(["DE", "FR"]);
  });

  it("applies each country's own packaging scheme", () => {
    const [de, fr] = report.products[0]!.markets;
    const ids = (m: typeof de) => m!.blocking.map((a) => a.requirement_id);
    expect(ids(de)).toContain("de.epr.packaging-lucid");
    expect(ids(de)).not.toContain("fr.epr.packaging-citeo");
    expect(ids(fr)).toContain("fr.epr.packaging-citeo");
  });
});

describe("limits", () => {
  it("refuses a file past the row cap", () => {
    const big = "SKU\n" + Array.from({ length: 50 }, (_, i) => `A${i}`).join("\n");
    expect(() => scan(big, { catalog, markets: ["DE"], asOf: "2026-09-12", maxRows: 10 })).toThrow(
      CsvTooLargeError,
    );
  });

  it("works with no channel, and says what it cannot decide without one", () => {
    const report = run("SKU,Country of Origin\nA1,China\n", ["DE"], null);
    const unresolved = report.products[0]!.markets[0]!.unresolved;
    expect(unresolved.map((a) => a.requirement_id)).toContain("eu.dsa.trader-information");
    expect(report.questions.map((q) => q.factPath)).toContain("channel.type");
  });
});
