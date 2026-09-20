/**
 * The hard rule at the import boundary. If any of these flip, the catalog's three-valued logic
 * is being fed two-valued data and every guarantee above it is void.
 */

import { describe, expect, it } from "vitest";
import { coerceBoolean, coerceCountry, coerceGtin, coerceText } from "../src/values.ts";

describe("booleans", () => {
  it("reads a blank cell as unknown, never as false", () => {
    // The single most consequential line in the importer. A seller who filled in only the rows
    // that DO have batteries looks identical to a system that has no battery field at all.
    expect(coerceBoolean("").value).toBeUndefined();
  });

  it("reads yes and no in several languages", () => {
    for (const yes of ["yes", "Y", "TRUE", "1", "x", "ja", "oui"]) {
      expect(coerceBoolean(yes).value, yes).toBe(true);
    }
    for (const no of ["no", "N", "false", "0", "nein", "non"]) {
      expect(coerceBoolean(no).value, no).toBe(false);
    }
  });

  it("reads an unrecognised value as unknown, and says so", () => {
    const result = coerceBoolean("maybe?");
    expect(result.value).toBeUndefined();
    expect(result.warning).toMatch(/not a yes\/no value/);
  });
});

describe("countries", () => {
  it("accepts ISO codes and normalises case", () => {
    expect(coerceCountry("de").value).toBe("DE");
  });

  it("maps common names, including German and French spellings", () => {
    expect(coerceCountry("China").value).toBe("CN");
    expect(coerceCountry("Deutschland").value).toBe("DE");
    expect(coerceCountry("United Kingdom").value).toBe("GB");
    expect(coerceCountry("P.R. China").value).toBe("CN");
  });

  it("refuses to pass through something it does not recognise", () => {
    // Passing "Made in PRC" through would derive as non-EU — right by accident, still a bug.
    const result = coerceCountry("Made in PRC");
    expect(result.value).toBeUndefined();
    expect(result.warning).toMatch(/not recognised as a country/);
  });

  it("distinguishes a blank cell from an explicit none", () => {
    expect(coerceCountry("").value).toBeUndefined();
    expect(coerceCountry("N/A").value).toBeNull();
  });
});

describe("text", () => {
  it("treats a blank cell as unknown rather than an empty string", () => {
    // "" would satisfy a required-data check that is really still outstanding.
    expect(coerceText("  ").value).toBeUndefined();
  });

  it("records an explicit none as a real answer", () => {
    expect(coerceText("none").value).toBeNull();
  });
});

describe("barcodes", () => {
  it("accepts valid lengths and strips separators", () => {
    expect(coerceGtin("5012345678900").value).toBe("5012345678900");
    expect(coerceGtin("5012-3456 78900").value).toBe("5012345678900");
  });

  it("rejects a malformed barcode rather than storing it", () => {
    const result = coerceGtin("12345");
    expect(result.value).toBeUndefined();
    expect(result.warning).toMatch(/not a valid GTIN/);
  });
});
