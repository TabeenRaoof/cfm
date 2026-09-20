import { describe, expect, it } from "vitest";
import { importProducts } from "../src/import.ts";

const run = (csv: string) => importProducts(csv, { maxRows: 1000 });

describe("importProducts", () => {
  it("maps recognised headers to fact paths", () => {
    const result = run("SKU,Country of Origin,Contains Battery\nA1,China,yes\n");
    expect(result.products[0]?.facts).toEqual({
      "product.sku": "A1",
      "manufacturer.country": "CN",
      "product.has_battery": true,
    });
  });

  it("matches headers regardless of case, spaces, underscores and hyphens", () => {
    const result = run("item-sku,COUNTRY_OF_ORIGIN\nA1,DE\n");
    expect(result.mapped.map((m) => m.factPath)).toEqual(["product.sku", "manufacturer.country"]);
  });

  it("never writes an unknown fact as a present key", () => {
    // A later `"product.has_battery" in facts` check must mean "we were told", not "there was
    // a column". Writing the key with an undefined value would quietly break that.
    const result = run("SKU,Contains Battery\nA1,\n");
    expect(Object.keys(result.products[0]!.facts)).toEqual(["product.sku"]);
  });

  it("reports columns it did not understand rather than dropping them silently", () => {
    const result = run("SKU,Warehouse Bin,Reorder Point\nA1,B12,5\n");
    expect(result.unmapped).toEqual(["Warehouse Bin", "Reorder Point"]);
  });

  it("reports the facts no column supplied, which is the useful half of the output", () => {
    const result = run("SKU\nA1\n");
    const absent = result.absentFacts.map((f) => f.factPath);
    expect(absent).toContain("manufacturer.country");
    expect(absent).toContain("product.has_battery");
    expect(absent).not.toContain("product.sku");
  });

  it("keeps the first of two columns claiming the same fact", () => {
    const result = run("Country of Origin,Made in\nDE,CN\n");
    expect(result.products[0]?.facts["manufacturer.country"]).toBe("DE");
    expect(result.unmapped).toEqual(["Made in"]);
  });

  it("numbers rows the way the seller's spreadsheet does", () => {
    const result = run("SKU\nA1\nA2\n");
    expect(result.products.map((p) => p.row)).toEqual([2, 3]);
  });

  it("skips blank rows", () => {
    expect(run("SKU\nA1\n\nA2\n").products).toHaveLength(2);
  });

  it("flags duplicate SKUs", () => {
    expect(run("SKU\nA1\nA2\nA1\n").duplicateSkus).toEqual(["A1"]);
  });

  it("attaches coercion warnings to the row and column they came from", () => {
    const result = run("SKU,Contains Battery\nA1,yes\nA2,dunno\n");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ row: 3, column: "Contains Battery" });
  });
});
