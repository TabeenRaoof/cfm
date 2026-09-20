/**
 * Narrowing must be invisible. If a slice ever produces a different answer from the full
 * catalog, the build step has become a place where obligations quietly disappear — the same
 * failure as a false `na`, moved somewhere nobody would look for it.
 */

import { describe, expect, it } from "vitest";
import { assessProduct } from "../src/evaluate.ts";
import { sliceForMarket } from "../src/slice.ts";
import { AS_OF, FULLY_KNOWN, loadRealCatalog, without } from "./fixtures.ts";

const { catalog } = await loadRealCatalog(true);

const MARKETS = ["DE", "FR", "ES", "IT", "NL", "AT", "BE", "GB"] as const;

/** Fact bags spanning the interesting shapes, including the ones that are mostly unknown. */
const SUBJECTS = [
  { label: "everything known", facts: FULLY_KNOWN },
  { label: "nothing known", facts: {} },
  { label: "no manufacturer country", facts: without(FULLY_KNOWN, "manufacturer.country") },
  { label: "no packaging answer", facts: without(FULLY_KNOWN, "product.has_packaging") },
  { label: "EU-established seller", facts: { ...FULLY_KNOWN, "organisation.establishment_country": "DE" } },
  { label: "EU manufacturer", facts: { ...FULLY_KNOWN, "manufacturer.country": "PL" } },
];

describe.each(MARKETS)("a slice for %s", (market) => {
  const slice = sliceForMarket(catalog, market);

  it("keeps at least one requirement, or the scanner shows an empty page", () => {
    expect(slice.requirements.length).toBeGreaterThan(0);
  });

  it("is actually smaller than the whole catalog", () => {
    // If it were not, the narrowing would be doing nothing and should be deleted rather than
    // maintained. Currently every market drops at least the other countries' schemes.
    expect(slice.requirements.length).toBeLessThan(catalog.requirements.length);
  });

  it.each(SUBJECTS.map((s) => [s.label, s.facts] as const))(
    "gives the same answer as the full catalog when %s",
    (_label, facts) => {
      const subject = { facts, market: { iso_country: market }, channel: { type: "amazon_de" } };
      const full = assessProduct(catalog, subject, { asOf: AS_OF });
      const narrowed = assessProduct(slice, subject, { asOf: AS_OF });

      // Requirements dropped by the slice are exactly the ones the full catalog calls `na`.
      const meaningful = full.assessments.filter((a) => a.status !== "na");
      expect(narrowed.assessments.filter((a) => a.status !== "na")).toEqual(meaningful);
      expect(narrowed.market_ready).toBe(full.market_ready);
      expect(narrowed.questions).toEqual(full.questions);
    },
  );

  it("never drops a requirement that is merely undecidable here", () => {
    // The dangerous case: a requirement whose applicability depends on the product, not the
    // market. It must survive into every slice, because at build time we know no products.
    const undecidable = catalog.requirements.filter(
      (r) =>
        assessProduct(catalog, { facts: {}, market: { iso_country: market } }, { asOf: AS_OF })
          .assessments.find((a) => a.requirement_id === r.id)?.status === "unknown",
    );
    const kept = new Set(slice.requirements.map((r) => r.id));
    for (const r of undecidable) expect(kept.has(r.id), `${r.id} was dropped from ${market}`).toBe(true);
  });
});

describe("what each market actually drops", () => {
  it("keeps a national scheme only in its own country", () => {
    expect(sliceForMarket(catalog, "DE").requirements.map((r) => r.id)).toContain("de.epr.packaging-lucid");
    expect(sliceForMarket(catalog, "FR").requirements.map((r) => r.id)).not.toContain("de.epr.packaging-lucid");
  });

  it("keeps EU requirements out of the UK slice, and the reverse", () => {
    const gb = sliceForMarket(catalog, "GB").requirements.map((r) => r.id);
    expect(gb).toContain("uk.gpsr.uk-responsible-person");
    expect(gb).not.toContain("eu.gpsr.responsible-economic-operator");
  });
});
