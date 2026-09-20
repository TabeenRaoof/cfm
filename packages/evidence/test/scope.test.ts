import { describe, expect, it } from "vitest";
import { requirementMarketScope } from "../src/scope.ts";
import { marketIs, requirement } from "./fixtures.ts";

describe("requirementMarketScope", () => {
  it("reads a single country from a plain equality leaf", () => {
    const de = requirement({
      id: "de.epr.packaging-lucid",
      applies_when: { all: [marketIs("DE"), { "product.has_packaging": true }] },
    });
    const scope = requirementMarketScope(de);
    expect(scope).toEqual({ kind: "countries", isoCountries: new Set(["DE"]) });
  });

  it("reads every country named across an 'any' branch", () => {
    const multi = requirement({
      id: "multi.epr",
      applies_when: { any: [marketIs("DE"), marketIs("AT")] },
    });
    const scope = requirementMarketScope(multi);
    expect(scope.kind).toBe("countries");
    expect(scope.kind === "countries" && scope.isoCountries).toEqual(new Set(["DE", "AT"]));
  });

  it("reads an 'in' matcher on market.iso_country as the set it lists", () => {
    const inMatcher = requirement({
      id: "in.epr",
      applies_when: { "market.iso_country": { in: ["DE", "AT", "NL"] } },
    });
    const scope = requirementMarketScope(inMatcher);
    expect(scope.kind === "countries" && scope.isoCountries).toEqual(new Set(["DE", "AT", "NL"]));
  });

  it("is unscoped when the condition never names a specific market — an EU-wide obligation", () => {
    // eu.gpsr.responsible-economic-operator's actual shape: EU-wide, not one country.
    const rpMandate = requirement({
      id: "eu.gpsr.responsible-economic-operator",
      applies_when: { all: [{ "market.jurisdiction": "EU" }, { "manufacturer.country_in_eu": false }] },
    });
    expect(requirementMarketScope(rpMandate)).toEqual({ kind: "unscoped" });
  });

  it("is unscoped for an unconditional requirement", () => {
    expect(requirementMarketScope(requirement({ id: "always", applies_when: { always: true } }))).toEqual({
      kind: "unscoped",
    });
  });

  it("collects a country nested inside 'not', without evaluating the negation", () => {
    // Deliberately not asking "does this apply" — only "which markets does the text mention" —
    // so a country inside a `not` still counts as naming that market.
    const negated = requirement({
      id: "negated",
      applies_when: { all: [{ not: marketIs("DE") }, { "product.has_packaging": true }] },
    });
    const scope = requirementMarketScope(negated);
    expect(scope.kind === "countries" && scope.isoCountries).toEqual(new Set(["DE"]));
  });

  it("ignores an exists/comparison matcher on market.iso_country rather than guessing a country", () => {
    const strange = requirement({
      id: "strange",
      applies_when: { "market.iso_country": { exists: true } },
    });
    expect(requirementMarketScope(strange)).toEqual({ kind: "unscoped" });
  });
});
