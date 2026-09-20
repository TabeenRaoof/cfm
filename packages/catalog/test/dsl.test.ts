import { describe, expect, it } from "vitest";
import type { Condition } from "../src/dsl.ts";
import { evaluateCondition, factPathsIn } from "../src/dsl.ts";
import type { EvaluationSubject } from "../src/facts.ts";

const subject = (facts: Record<string, unknown>): EvaluationSubject => ({
  facts: facts as EvaluationSubject["facts"],
  market: { iso_country: "DE" },
  channel: { type: "amazon_de" },
});

const truth = (c: Condition, facts: Record<string, unknown> = {}) =>
  evaluateCondition(c, subject(facts)).truth;

describe("leaf matchers", () => {
  it("compares by equality", () => {
    expect(truth({ "product.category_code": "toys" }, { "product.category_code": "toys" })).toBe("true");
    expect(truth({ "product.category_code": "toys" }, { "product.category_code": "tools" })).toBe("false");
  });

  it("is unknown when the fact was never supplied", () => {
    expect(truth({ "product.category_code": "toys" })).toBe("unknown");
  });

  it("supports membership", () => {
    const c: Condition = { "product.category_code": { in: ["toys", "childcare"] } };
    expect(truth(c, { "product.category_code": "childcare" })).toBe("true");
    expect(truth(c, { "product.category_code": "tools" })).toBe("false");
    expect(truth(c)).toBe("unknown");
  });

  it("treats presence and knowledge as different questions", () => {
    const c: Condition = { "product.gtin": { exists: true } };
    expect(truth(c, { "product.gtin": "5012345678900" })).toBe("true");
    // Known to have none — that is an answer.
    expect(truth(c, { "product.gtin": null })).toBe("false");
    // Never told — that is not.
    expect(truth(c)).toBe("unknown");
  });

  it("refuses a leaf naming more than one fact", () => {
    // Silently ignoring the second key would be a wrong legal answer, not a rendering glitch.
    expect(() => truth({ a: 1, b: 2 } as unknown as Condition)).toThrow(/exactly one fact path/);
  });
});

describe("operators", () => {
  const applies: Condition = {
    all: [{ "market.jurisdiction": "EU" }, { "manufacturer.country_in_eu": false }],
  };

  it("applies when every branch holds", () => {
    expect(truth(applies, { "manufacturer.country": "CN" })).toBe("true");
  });

  it("does not apply when a branch is decidedly false", () => {
    expect(truth(applies, { "manufacturer.country": "FR" })).toBe("false");
  });

  it("is unknown — never false — when a branch cannot be decided", () => {
    // This single assertion is the product's hard rule in miniature.
    expect(truth(applies)).toBe("unknown");
  });

  it("carries the answerable question out of the unknown branch", () => {
    const result = evaluateCondition(applies, subject({}));
    expect(result.missing).toEqual(["manufacturer.country"]);
  });

  it("handles any and not", () => {
    expect(truth({ any: [{ "product.is_toy": true }, { "product.has_battery": true }] }, { "product.is_toy": false, "product.has_battery": true })).toBe("true");
    expect(truth({ not: { "product.is_toy": true } }, { "product.is_toy": false })).toBe("true");
    expect(truth({ not: { "product.is_toy": true } })).toBe("unknown");
  });

  it("treats always as unconditional", () => {
    expect(truth({ always: true })).toBe("true");
  });
});

describe("factPathsIn", () => {
  it("walks the whole tree", () => {
    const c: Condition = {
      all: [{ "market.jurisdiction": "EU" }, { any: [{ "product.is_toy": true }, { not: { "product.has_battery": true } }] }],
    };
    expect([...factPathsIn(c)].sort()).toEqual(["market.jurisdiction", "product.has_battery", "product.is_toy"]);
  });
});

describe("numeric thresholds", () => {
  // Several obligations switch on a size threshold rather than a category — UK packaging EPR
  // exempts sellers under 25 tonnes and £1m turnover, for instance.
  const over: Condition = { "organisation.annual_turnover_gbp": { gte: 1_000_000 } };

  it("compares numbers", () => {
    expect(truth(over, { "organisation.annual_turnover_gbp": 2_000_000 })).toBe("true");
    expect(truth(over, { "organisation.annual_turnover_gbp": 900_000 })).toBe("false");
    expect(truth(over, { "organisation.annual_turnover_gbp": 1_000_000 })).toBe("true");
  });

  it("supports a bounded range", () => {
    const band: Condition = { "organisation.packaging_tonnes": { gt: 25, lt: 100 } };
    expect(truth(band, { "organisation.packaging_tonnes": 50 })).toBe("true");
    expect(truth(band, { "organisation.packaging_tonnes": 25 })).toBe("false");
  });

  it("is unknown when the figure was never supplied", () => {
    expect(truth(over)).toBe("unknown");
  });

  it("is unknown — not 'under the threshold' — when the value is not a number", () => {
    // Reading "about a million" as below the threshold would exempt exactly the seller who
    // most needed telling.
    expect(truth(over, { "organisation.annual_turnover_gbp": "about a million" })).toBe("unknown");
  });
});
