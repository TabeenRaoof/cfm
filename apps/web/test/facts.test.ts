/**
 * Row ↔ fact-bag translation (src/domain/facts.ts). The property: what the CSV said is exactly
 * what the evaluator sees — unknown stays unknown, "none" survives where it can, and nothing is
 * defaulted along the way. The last test runs the whole round trip through the real migration.
 */

import { importProducts } from "@cfm/import";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { catalog, catalogIssues } from "../src/domain/catalog.ts";
import {
  factFields,
  ORGANISATION_FACT_PREFIXES,
  productFacts,
  subjectFacts,
  toImportRows,
  type ProductRow,
} from "../src/domain/facts.ts";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const CSV = [
  "SKU,Title,Has battery,Country of origin,Manufacturer,Responsible person,Brand",
  "K-1,Kettle,no,CN,Shenzhen Co,none,Acme",
  "T-1,Toy robot,,,,,",
  ",No SKU here,yes,DE,,,",
].join("\n");

describe("toImportRows", () => {
  const prepared = toImportRows(importProducts(CSV, { maxRows: 100 }));

  it("maps typed facts to columns and everything else into the facts bag", () => {
    expect(prepared.rows[0]).toEqual({
      sku: "K-1", title: "Kettle", brand: "Acme", has_battery: false, manufacturer_country: "CN",
      facts: { "manufacturer.name": "Shenzhen Co", "rp.name": null },
    });
  });

  it("sends nothing at all for blank cells — no false, no empty string, no null", () => {
    expect(prepared.rows[1]).toEqual({ sku: "T-1", title: "Toy robot", facts: {} });
  });

  it("keeps 'none' as JSON null in the facts bag, where it can be kept", () => {
    expect(prepared.rows[0]?.facts).toHaveProperty(["rp.name"], null);
  });

  it("a 'none' for a typed fact becomes unknown — the documented, conservative collapse", () => {
    const typedNone = toImportRows(importProducts("SKU,Country of origin\nX-1,none", { maxRows: 10 }));
    expect(typedNone.rows[0]).toEqual({ sku: "X-1", facts: {} });
  });

  it("skips rows without a SKU and says which", () => {
    expect(prepared.rows.map((r) => r.sku)).toEqual(["K-1", "T-1"]);
    expect(prepared.skippedRows).toEqual([4]);
  });
});

describe("productFacts / subjectFacts", () => {
  const row: ProductRow = {
    sku: "K-1", title: "Kettle", brand: null, category_code: null, gtin: null,
    has_battery: false, is_electrical: null, is_toy: null, has_packaging: true,
    manufacturer_country: "CN", facts: { "rp.name": null },
  };

  it("a NULL typed column contributes no key (unknown), a false one contributes false", () => {
    const bag = productFacts(row);
    expect(bag).toMatchObject({ "product.has_battery": false, "product.has_packaging": true, "manufacturer.country": "CN" });
    expect("product.is_electrical" in bag).toBe(false);
    expect("product.brand" in bag).toBe(false);
  });

  it("organisation facts join product facts; an unstated establishment country stays unknown", () => {
    const withCountry = subjectFacts({ establishment_country: "GB", facts: { "organisation.vat_number": "GB1" } }, row);
    expect(withCountry).toMatchObject({ "organisation.establishment_country": "GB", "organisation.vat_number": "GB1", "rp.name": null });
    const without = subjectFacts({ establishment_country: null, facts: {} }, row);
    expect("organisation.establishment_country" in without).toBe(false);
  });
});

describe("factFields — derived from the catalog", () => {
  it("the bundled catalog loads with no issues and only published requirements", () => {
    expect(catalogIssues).toEqual([]);
    expect(catalog.requirements.length).toBeGreaterThan(0);
    expect(catalog.requirements.every((r) => r.state === "published")).toBe(true);
  });

  it("offers organisation-scope facts with their kinds, and never a derived fact", () => {
    const fields = factFields(catalog, ORGANISATION_FACT_PREFIXES, ["organisation.establishment_country"]);
    const byPath = new Map(fields.map((f) => [f.path, f]));
    expect(byPath.get("organisation.sells_direct_to_end_users")?.kind).toBe("boolean");
    expect(byPath.get("organisation.nl_packaging_kg_previous_year")?.kind).toBe("number");
    expect(byPath.get("organisation.vat_number")?.kind).toBe("text");
    expect(byPath.has("organisation.established_in_market")).toBe(false);
    expect(byPath.has("organisation.establishment_country")).toBe(false);
    expect(fields.every((f) => /^(organisation|packaging)\./.test(f.path))).toBe(true);
  });
});

describe("the full round trip through the real migration", () => {
  let db: PGlite;
  const OWNER = "a0000000-0000-4000-8000-000000000001";
  let org: string;

  beforeAll(async () => {
    db = await createDatabase();
    await createUser(db, OWNER, "owner@acme.test");
    org = await as(db, user(OWNER), async (tx) =>
      (await tx.query<{ id: string }>("select public.create_organisation('Acme', 'GB') as id")).rows[0]!.id,
    { commit: true });
  });
  afterAll(async () => {
    await db.close();
  });

  it("CSV → import_products → database → evaluator facts equals what the importer read", async () => {
    const imported = importProducts(CSV, { maxRows: 100 });
    const { rows } = toImportRows(imported);
    await as(db, user(OWNER), (tx) =>
      tx.query("select * from public.import_products($1, $2::jsonb)", [org, JSON.stringify(rows)]),
    { commit: true });

    const stored = (await db.query<ProductRow>(
      "select sku, title, brand, category_code, gtin, has_battery, is_electrical, is_toy, has_packaging, manufacturer_country, facts from public.product where organisation_id = $1 order by sku",
      [org],
    )).rows;

    for (const original of imported.products.filter((p) => p.sku)) {
      const back = productFacts(stored.find((s) => s.sku === original.sku)!);
      expect(back).toEqual(original.facts);
    }
  });
});
