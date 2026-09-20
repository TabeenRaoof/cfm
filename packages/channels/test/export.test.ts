import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assessProduct } from "@cfm/catalog";
import { loadCatalogFromDir } from "@cfm/catalog/node";
import { renderChannelExport } from "../src/export.ts";
import { renderFullExport } from "../src/full-export.ts";
import { loadTemplate, loadTemplates } from "../src/node.ts";
import { UnverifiedTemplateError } from "../src/template.ts";
import type { ChannelTemplate, ExportRow } from "../src/template.ts";
import { writeCsv } from "../src/csv-write.ts";

const catalogRoot = new URL("../../catalog/", import.meta.url).pathname;
const manifest = JSON.parse(await readFile(join(catalogRoot, "catalog.json"), "utf8")) as { version: string };
const { catalog } = await loadCatalogFromDir(join(catalogRoot, "requirements"), {
  version: manifest.version,
  includeDrafts: true,
});

const row = (facts: Record<string, unknown>, sku = "TOY-001"): ExportRow => ({
  sku,
  title: "Wooden train set",
  facts: facts as ExportRow["facts"],
  assessment: assessProduct(
    catalog,
    { facts: facts as never, market: { iso_country: "DE" }, channel: { type: "amazon_de" } },
    { asOf: "2026-09-13" },
  ),
});

const KNOWN = {
  "manufacturer.country": "CN",
  "manufacturer.name": "Shenzhen Example Co",
  "manufacturer.address": "1 Example Road",
  "rp.name": "Example EU Rep GmbH",
  "rp.address": "1 Beispielstraße, Berlin",
  "rp.contact": "rp@example.com",
  "product.has_packaging": true,
};

const verified = (over: Partial<ChannelTemplate> = {}): ChannelTemplate => ({
  id: "test",
  label: "Test channel",
  template_version: "1",
  verified: true,
  source: null,
  columns: [
    { header: "sku", source: { kind: "sku" } },
    { header: "rp", source: { kind: "fact", path: "rp.name" } },
    { header: "battery", source: { kind: "fact", path: "product.has_battery" } },
  ],
  notes: [],
  ...over,
});

describe("the hard rule at the export boundary", () => {
  // This is the last place our data passes before entering a system we do not control and
  // cannot correct. A fact we were never told must leave as an empty cell.
  it("exports an unknown fact as blank, never as 'No'", () => {
    const result = renderChannelExport(verified(), [row(KNOWN)]);
    const [, values] = result.csv.trim().split("\r\n");
    expect(values).toBe("TOY-001,Example EU Rep GmbH,");
    expect(result.csv).not.toContain("No");
  });

  it("counts the blanks that are gaps, and says why", () => {
    const result = renderChannelExport(verified(), [row(KNOWN)]);
    expect(result.blankBecauseUnknown).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/blank rather than "no" on purpose/);
  });

  it("exports a known negative as 'No', which is a different thing", () => {
    const result = renderChannelExport(verified(), [row({ ...KNOWN, "product.has_battery": false })]);
    expect(result.csv).toContain(",No");
    expect(result.blankBecauseUnknown).toBe(0);
  });

  it("exports a known-absent value as blank but not as a gap", () => {
    // null means the seller told us there is none. Nothing to chase.
    const result = renderChannelExport(verified(), [row({ ...KNOWN, "product.has_battery": null })]);
    expect(result.blankBecauseUnknown).toBe(0);
  });

  it("never renders an undetermined requirement as 'Not applicable'", () => {
    const template = verified({
      columns: [
        { header: "sku", source: { kind: "sku" } },
        { header: "toys", source: { kind: "requirement_status", requirement_id: "eu.flag.toy-safety" } },
      ],
    });
    const result = renderChannelExport(template, [row(KNOWN)]);
    expect(result.csv).toContain("Cannot determine - information needed");
    expect(result.csv).not.toContain("Not applicable");
  });
});

describe("unverified templates", () => {
  it("refuse to export by default", () => {
    // A guess dressed as a file is worse than no export: the seller uploads it, it is rejected,
    // and they conclude the tool does not work.
    expect(() => renderChannelExport(verified({ verified: false }), [row(KNOWN)])).toThrow(
      UnverifiedTemplateError,
    );
  });

  it("export only when the caller says so, and say so in the result", () => {
    const result = renderChannelExport(verified({ verified: false }), [row(KNOWN)], {
      allowUnverified: true,
    });
    expect(result.verified).toBe(false);
    expect(result.warnings[0]).toMatch(/has not been checked against/);
  });
});

describe("the templates that ship", () => {
  it("are all unverified, and say so", async () => {
    // Neither has been compared against a real downloaded template, so neither may claim to be.
    const templates = await loadTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.verified === false)).toBe(true);
  });

  it("the Amazon one is labelled a placeholder in a way nobody could miss", async () => {
    const amazon = await loadTemplate("amazon_myc");
    expect(amazon.notes[0]).toMatch(/PLACEHOLDER AND WILL BE REJECTED/);
    expect(amazon.columns.every((c) => c.note?.includes("PLACEHOLDER"))).toBe(true);
  });

  it("the Shopify one carries the documented header format and its source", async () => {
    const shopify = await loadTemplate("shopify_metafields");
    expect(shopify.source?.retrieved_at).toBe("2026-09-13");
    expect(shopify.columns.some((c) => c.header.includes("product.metafields.compliance."))).toBe(true);
  });

  it("report which of their columns nothing fills", async () => {
    const shopify = await loadTemplate("shopify_metafields");
    const result = renderChannelExport(shopify, [row({ "manufacturer.country": "CN" })], {
      allowUnverified: true,
    });
    expect(result.unfilledColumns).toContain(
      "EU responsible person (product.metafields.compliance.eu_responsible_person)",
    );
  });
});

describe("the neutral full export", () => {
  const result = renderFullExport([row(KNOWN), row(KNOWN, "TOY-002")]);

  it("needs no template and so cannot be wrong about someone else's format", () => {
    expect(result.rows).toBe(2);
    expect(result.csv.split("\r\n")[0]).toContain("SKU");
  });

  it("carries the catalog version and the assessment date", () => {
    expect(result.csv).toContain(catalog.version);
    expect(result.csv).toContain("2026-09-13");
  });

  it("gives the reason a SKU is not ready, not just the verdict", () => {
    expect(result.csv.split("\r\n")[0]).toContain("Information needed");
    expect(result.csv).toMatch(/product\.is_toy/);
  });

  it("has one column per requirement, in stable order", () => {
    expect(result.requirementColumns).toEqual([...result.requirementColumns].sort());
    expect(result.requirementColumns.length).toBeGreaterThan(5);
  });
});

describe("CSV writing", () => {
  it("quotes delimiters, quotes and newlines", () => {
    const csv = writeCsv(["a"], [['x,y'], ['he said "hi"'], ["line\nbreak"]], { bom: false });
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('"line\nbreak"');
  });

  it("quotes values with leading or trailing spaces, which importers otherwise trim", () => {
    expect(writeCsv(["a"], [[" padded "]], { bom: false })).toContain('" padded "');
  });

  it("writes a BOM by default, because sellers open these in Excel", () => {
    expect(writeCsv(["a"], [["b"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF, which is what spreadsheet importers expect", () => {
    expect(writeCsv(["a"], [["b"]], { bom: false })).toBe("a\r\nb\r\n");
  });
});
