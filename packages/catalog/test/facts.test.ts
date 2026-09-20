import { describe, expect, it } from "vitest";
import type { EvaluationSubject } from "../src/facts.ts";
import { EU_MEMBER_STATES, jurisdictionOf, resolveFact } from "../src/facts.ts";

const subject = (
  facts: Record<string, string | number | boolean | null | undefined>,
  iso = "DE",
  channel?: string,
): EvaluationSubject => ({
  facts,
  market: { iso_country: iso },
  ...(channel ? { channel: { type: channel } } : {}),
});

describe("jurisdiction", () => {
  it("maps member states to EU, GB to UK, and everything else to OTHER", () => {
    expect(jurisdictionOf("DE")).toBe("EU");
    expect(jurisdictionOf("GB")).toBe("UK");
    expect(jurisdictionOf("US")).toBe("OTHER");
  });

  it("has 27 member states", () => {
    expect(EU_MEMBER_STATES.size).toBe(27);
  });
});

describe("plain facts", () => {
  it("distinguishes absent from explicitly null", () => {
    // The whole three-valued design rests on this distinction holding at the boundary.
    expect(resolveFact("product.is_toy", subject({})).value).toBeUndefined();
    expect(resolveFact("product.is_toy", subject({ "product.is_toy": null })).value).toBeNull();
    expect(resolveFact("product.is_toy", subject({ "product.is_toy": false })).value).toBe(false);
  });

  it("names the missing path so the gap list can ask for it", () => {
    expect(resolveFact("product.is_toy", subject({})).missing).toEqual(["product.is_toy"]);
  });
});

describe("derived facts", () => {
  it("derives EU establishment from the manufacturer country", () => {
    expect(resolveFact("manufacturer.country_in_eu", subject({ "manufacturer.country": "FR" })).value).toBe(true);
    expect(resolveFact("manufacturer.country_in_eu", subject({ "manufacturer.country": "CN" })).value).toBe(false);
  });

  it("asks for the underlying input rather than the derivation", () => {
    // "manufacturer.country" is a question a customer can answer.
    // "manufacturer.country_in_eu" is not.
    const lookup = resolveFact("manufacturer.country_in_eu", subject({}));
    expect(lookup.value).toBeUndefined();
    expect(lookup.missing).toEqual(["manufacturer.country"]);
  });

  it("treats a null manufacturer country as still unknown, not as non-EU", () => {
    // Reading it as non-EU would wrongly switch on every non-EU obligation.
    const lookup = resolveFact("manufacturer.country_in_eu", subject({ "manufacturer.country": null }));
    expect(lookup.value).toBeUndefined();
  });

  it("compares establishment against the specific market, not the jurisdiction", () => {
    const inMarket = subject({ "organisation.establishment_country": "DE" }, "DE");
    const elsewhereInEu = subject({ "organisation.establishment_country": "FR" }, "DE");
    expect(resolveFact("organisation.established_in_market", inMarket).value).toBe(true);
    expect(resolveFact("organisation.established_in_market", elsewhereInEu).value).toBe(false);
  });

  it("knows a marketplace from an own storefront", () => {
    expect(resolveFact("channel.is_marketplace", subject({}, "DE", "amazon_de")).value).toBe(true);
    expect(resolveFact("channel.is_marketplace", subject({}, "DE", "shopify")).value).toBe(false);
  });

  it("does not guess the channel when none was given", () => {
    const lookup = resolveFact("channel.is_marketplace", subject({}, "DE"));
    expect(lookup.value).toBeUndefined();
    expect(lookup.missing).toEqual(["channel.type"]);
  });
});
