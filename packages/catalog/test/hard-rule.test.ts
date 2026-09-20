/**
 * THE HARD RULE, tested against every requirement actually in the repository.
 *
 * tabeen_AGENTS.md: "A requirement whose applicability cannot be determined from the data
 * actually known about a SKU is never `na`. It is `unknown`, and `unknown` is never counted
 * toward market-ready." decisions.md D-002.
 *
 * These tests are written against the real catalog rather than a fixture on purpose. A rule
 * that only holds for an example requirement is not a rule — the failure this prevents is
 * someone adding requirement number thirteen with a condition that reads absence as a "no".
 */

import { describe, expect, it } from "vitest";
import { assessProduct } from "../src/evaluate.ts";
import { isMarketReady } from "../src/types.ts";
import { AS_OF, FULLY_KNOWN, loadRealCatalog, without } from "./fixtures.ts";

const { catalog } = await loadRealCatalog(true);

const assess = (facts: typeof FULLY_KNOWN, iso = "DE", channel: string | null = "amazon_de") =>
  assessProduct(
    catalog,
    { facts, market: { iso_country: iso }, ...(channel ? { channel: { type: channel } } : {}) },
    { asOf: AS_OF },
  );

const factKeys = Object.keys(FULLY_KNOWN);

describe("removing a known fact", () => {
  const baseline = assess(FULLY_KNOWN);

  it("has a baseline where requirements actually apply, or the test proves nothing", () => {
    const applying = baseline.assessments.filter((a) => a.applicability === "true");
    expect(applying.length).toBeGreaterThan(4);
  });

  it.each(factKeys)("never turns a requirement into 'not applicable': %s", (key) => {
    const degraded = assess(without(FULLY_KNOWN, key));

    for (const after of degraded.assessments) {
      const before = baseline.assessments.find((a) => a.requirement_id === after.requirement_id);
      if (before && before.status !== "na") {
        expect(
          after.status,
          `Removing "${key}" made ${after.requirement_id} not-applicable. Knowing less must ` +
            `never remove an obligation — that is the false green this rule exists to stop.`,
        ).not.toBe("na");
      }
    }
  });

  it.each(factKeys)("never makes a SKU readier than it was: %s", (key) => {
    const degraded = assess(without(FULLY_KNOWN, key));

    for (const after of degraded.assessments) {
      const before = baseline.assessments.find((a) => a.requirement_id === after.requirement_id);
      if (before && !isMarketReady(before.status)) {
        expect(
          isMarketReady(after.status),
          `Removing "${key}" made ${after.requirement_id} count as ready. Monotonicity: less ` +
            `knowledge can only ever move a cell away from ready.`,
        ).toBe(false);
      }
    }
  });
});

describe("an unresolvable requirement", () => {
  it("is reported as unknown and names an answerable question", () => {
    const degraded = assess(without(FULLY_KNOWN, "manufacturer.country"));
    const rp = degraded.assessments.find(
      (a) => a.requirement_id === "eu.gpsr.responsible-economic-operator",
    );

    expect(rp?.status).toBe("unknown");
    expect(rp?.applicability).toBe("unknown");
    // The question is the underlying fact a customer can answer, not the derived one.
    expect(rp?.missing_facts).toEqual(["manufacturer.country"]);
  });

  it("keeps the whole SKU out of market-ready", () => {
    const facts = { ...FULLY_KNOWN };
    const degraded = assess(without(facts, "manufacturer.country"));
    expect(degraded.market_ready).toBe(false);
  });

  it("never counts as ready, even when nothing else is outstanding", () => {
    // The strongest form: a catalog cell that is unknown must fail readiness on its own.
    expect(isMarketReady("unknown")).toBe(false);
  });
});

describe("a SKU we know nothing about", () => {
  const blank = assess({});

  it("produces questions rather than a clean bill of health", () => {
    expect(blank.market_ready).toBe(false);
    expect(blank.questions.length).toBeGreaterThan(0);
  });

  it("marks nothing as not-applicable that would have applied had we been told", () => {
    // The boundary this test guards: `na` reached from a KNOWN fact is correct and expected —
    // a French scheme genuinely does not apply in Germany, and the market is never unknown
    // because the customer picks it. `na` reached from an UNKNOWN fact is the false green.
    // So the assertion is comparative, not absolute.
    const applied = new Set(
      assess(FULLY_KNOWN)
        .assessments.filter((a) => a.applicability === "true")
        .map((a) => a.requirement_id),
    );

    const wrongfullyDropped = blank.assessments.filter(
      (a) => a.status === "na" && applied.has(a.requirement_id),
    );
    expect(wrongfullyDropped.map((a) => a.requirement_id)).toEqual([]);
  });

  it("still returns na for a market whose scheme genuinely does not apply here", () => {
    // The complement of the test above, so that a future change cannot satisfy the hard rule
    // by making everything unknown — which would be safe, useless, and pass every other test.
    const french = blank.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo");
    expect(french?.status).toBe("na");
  });

  it("orders the questions so the most unblocking one comes first", () => {
    const counts = blank.questions.map(
      (q) => blank.assessments.filter((a) => a.missing_facts.includes(q)).length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
