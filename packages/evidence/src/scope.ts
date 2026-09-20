/**
 * Deriving which market a catalog requirement is scoped to, read from its own `applies_when`
 * condition — the only place a requirement's market lives. `Requirement` has no first-class
 * "country" field (`packages/catalog/src/types.ts`); market scoping is encoded the same way
 * every other applicability fact is, as a leaf in the condition tree, e.g.
 * `{ "market.iso_country": "DE" }`.
 *
 * This never evaluates the condition — `evaluateCondition` (`@cfm/catalog`) does that, against
 * a real subject, and answers a different question ("does this requirement apply to this
 * SKU?"). This module only asks: does the tree name a specific market at all, and if so which?
 * A requirement scoped EU-wide (`market.jurisdiction`) or unconditionally (`always`) has no
 * `market.iso_country` leaf anywhere in it and correctly comes back "unscoped" — which is
 * exactly right for a document type like `rp_mandate`, one EU-wide appointment that is not tied
 * to a single market, as opposed to `epr_certificate`, which is.
 */

import type { Condition, Matcher, Requirement } from "@cfm/catalog";

export type MarketScope =
  | { readonly kind: "unscoped" }
  | { readonly kind: "countries"; readonly isoCountries: ReadonlySet<string> };

const MARKET_COUNTRY_PATH = "market.iso_country";

export function requirementMarketScope(requirement: Requirement): MarketScope {
  const countries = new Set<string>();
  collectCountries(requirement.applies_when, countries);
  return countries.size === 0 ? { kind: "unscoped" } : { kind: "countries", isoCountries: countries };
}

/**
 * Collects every ISO country named against `market.iso_country` anywhere in the tree, without
 * evaluating the tree's boolean logic. That is deliberate: this function answers "which markets
 * does this requirement's text mention at all", not "does it apply" — an `any` naming DE and AT
 * means the requirement covers both, which is exactly the case a plain equality leaf cannot
 * express and a set-based scope has to.
 */
function collectCountries(condition: Condition, into: Set<string>): void {
  // Cast the same way dsl.ts's own factPathsIn does: Condition's last member is an index
  // signature, which makes TS unify `.all`/`.any`/`.not` access against it rather than the
  // specific branch unless the access is cast explicitly.
  if ("always" in condition) return;
  if ("all" in condition) {
    for (const branch of condition.all as readonly Condition[]) collectCountries(branch, into);
    return;
  }
  if ("any" in condition) {
    for (const branch of condition.any as readonly Condition[]) collectCountries(branch, into);
    return;
  }
  if ("not" in condition) {
    collectCountries(condition.not as Condition, into);
    return;
  }

  const leaf = condition as Readonly<Record<string, Matcher>>;
  const path = Object.keys(leaf)[0];
  if (path !== MARKET_COUNTRY_PATH) return;

  const matcher = leaf[path] as Matcher;
  if (typeof matcher === "string") {
    into.add(matcher);
    return;
  }
  if (typeof matcher === "object" && matcher !== null && "in" in matcher) {
    for (const value of matcher.in) {
      if (typeof value === "string") into.add(value);
    }
  }
  // exists/gte/gt/lte/lt matchers on market.iso_country would be a strange requirement — a
  // country code is not a presence check or a number — so they are deliberately not handled
  // here; the requirement would come back "unscoped" rather than this function guessing.
}
