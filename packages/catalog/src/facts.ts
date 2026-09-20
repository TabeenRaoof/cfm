/**
 * Fact resolution: turning what we know about a SKU, a market and a seller into the values
 * that `applies_when` conditions are evaluated against.
 *
 * THE CENTRAL DISTINCTION IN THIS FILE:
 *
 *   undefined / key absent  →  we do not know          →  Truth "unknown"
 *   null                    →  we know there is none   →  a real, usable answer
 *
 * These are not interchangeable and the importer must not conflate them. A CSV without a
 * `has_battery` column yields `undefined` for every row; a CSV whose `has_battery` column is
 * empty for one row is a judgement call the importer has to make deliberately, and the safe
 * direction is `undefined`. Getting this backwards re-introduces exactly the false-green bug
 * that three-valued logic exists to prevent.
 */

import type { TruthResult } from "./truth.ts";
import { unknown } from "./truth.ts";

export type FactValue = string | number | boolean | null;

/** Flat, dotted-path view of everything known. Absent key === unknown. */
export type FactBag = Readonly<Record<string, FactValue | undefined>>;

export interface FactLookup {
  /** `undefined` means unknown; `null` means known-to-be-absent. */
  readonly value: FactValue | undefined;
  /**
   * When the value is unknown, the fact paths worth asking the customer for. For a derived
   * fact this names the *underlying* input rather than the derivation, because
   * "manufacturer.country" is something a customer can answer and
   * "manufacturer.country_in_eu" is not.
   */
  readonly missing: readonly string[];
}

/**
 * EU member states, ISO 3166-1 alpha-2, as of 2026. Used only to derive establishment facts.
 *
 * This is deliberately a hard-coded constant rather than a catalog requirement: membership is
 * not a regulatory requirement, it is an input to many of them, and a stale list here would
 * silently change the output of every derived fact. Any change to it is a code change with a
 * test, not a data edit.
 */
export const EU_MEMBER_STATES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Channel type prefixes that are third-party marketplaces rather than own storefronts. */
const MARKETPLACE_CHANNEL_PREFIXES = ["amazon", "bol", "etsy", "ebay", "zalando", "cdiscount", "allegro"];

export interface MarketContext {
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  readonly iso_country: string;
}

export interface ChannelContext {
  /** e.g. "amazon_de", "shopify", "bol", "etsy", "ebay". */
  readonly type: string;
}

export interface EvaluationSubject {
  readonly facts: FactBag;
  readonly market: MarketContext;
  readonly channel?: ChannelContext;
}

/**
 * Facts computed from other facts. Each returns `undefined` when its inputs are unknown, and
 * reports the input paths so the gap list can ask for something answerable.
 */
type Derivation = (subject: EvaluationSubject) => FactLookup;

const DERIVED: Readonly<Record<string, Derivation>> = {
  "market.iso_country": (s) => known(s.market.iso_country),

  "market.jurisdiction": (s) => known(jurisdictionOf(s.market.iso_country)),

  "channel.type": (s) => (s.channel ? known(s.channel.type) : missing("channel.type")),

  /**
   * Marketplace obligations (DSA trader traceability, listing-field enforcement) attach to
   * selling through someone else's platform, not to selling online. A brand's own Shopify
   * storefront is not a marketplace and does not inherit them.
   */
  "channel.is_marketplace": (s) => {
    if (!s.channel) return missing("channel.type");
    return known(MARKETPLACE_CHANNEL_PREFIXES.some((p) => s.channel!.type.startsWith(p)));
  },

  "manufacturer.country_in_eu": (s) =>
    inEu(s.facts["manufacturer.country"], "manufacturer.country"),

  "organisation.established_in_eu": (s) =>
    inEu(s.facts["organisation.establishment_country"], "organisation.establishment_country"),

  /**
   * Whether the seller is established in the specific market being assessed. Drives the
   * "appoint a representative in every member state where you are not established" family of
   * obligations, which is per-market rather than per-jurisdiction.
   */
  "organisation.established_in_market": (s) => {
    const country = s.facts["organisation.establishment_country"];
    if (country === undefined) return missing("organisation.establishment_country");
    if (country === null) return known(false);
    return known(country === s.market.iso_country);
  },
};

export function resolveFact(path: string, subject: EvaluationSubject): FactLookup {
  const derivation = DERIVED[path];
  if (derivation) return derivation(subject);

  const value = subject.facts[path];
  return value === undefined ? missing(path) : known(value);
}

/** Fact paths the evaluator can answer without being told. Used by the loader's spell-check. */
export function derivedFactPaths(): readonly string[] {
  return Object.keys(DERIVED);
}

export function jurisdictionOf(isoCountry: string): string {
  if (EU_MEMBER_STATES.has(isoCountry)) return "EU";
  if (isoCountry === "GB") return "UK";
  return "OTHER";
}

export function unknownFrom(lookup: FactLookup): TruthResult {
  return unknown(lookup.missing);
}

function known(value: FactValue): FactLookup {
  return { value, missing: [] };
}

function missing(path: string): FactLookup {
  return { value: undefined, missing: [path] };
}

function inEu(country: FactValue | undefined, sourcePath: string): FactLookup {
  if (country === undefined) return missing(sourcePath);
  // A seller who tells us they have no manufacturer country is telling us something, but not
  // something that decides EU membership. Treat it as still-unknown rather than as "not EU",
  // which would wrongly trigger the non-EU obligations.
  if (country === null) return missing(sourcePath);
  return known(typeof country === "string" && EU_MEMBER_STATES.has(country));
}
