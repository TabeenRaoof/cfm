/**
 * Narrowing the catalog to one market.
 *
 * The public scanner runs in the visitor's browser, so whatever it evaluates against is
 * downloadable. Shipping one file containing everything would make "narrowed" a figure of
 * speech; instead each market gets its own slice and a scraper has to enumerate markets rather
 * than press save once. That is a speed bump, not a secret — anything in a browser is
 * extractable — and it is the honest limit of what client-side evaluation can protect
 * (decisions.md D-020).
 *
 * THE SAFETY PROPERTY, AND WHY IT FALLS OUT FOR FREE:
 *
 * A requirement may be dropped from a market's slice only when it can *never* apply there.
 * "Never" has to mean provably never, not probably never — dropping a requirement that would
 * have applied is the false green the whole product is built to avoid, just relocated into a
 * build step.
 *
 * So the test is the evaluator itself, run with the market known and everything else unknown.
 * Three-valued logic already distinguishes "decidably does not apply here" from "cannot tell
 * yet", and only the first is safe to drop. A requirement that comes back `unknown` — because
 * it depends on the product or the seller — stays in every slice.
 */

import type { Catalog } from "./catalog.ts";
import { evaluateCondition } from "./dsl.ts";
import type { EvaluationSubject } from "./facts.ts";
import type { Requirement } from "./types.ts";

/**
 * Requirements that could apply in this market, for some product, sold by some seller, on some
 * channel. Everything the market alone cannot rule out.
 */
export function sliceForMarket(catalog: Catalog, isoCountry: string): Catalog {
  return {
    version: catalog.version,
    requirements: catalog.requirements.filter((r) => couldApplyIn(r, isoCountry)),
  };
}

export function couldApplyIn(requirement: Requirement, isoCountry: string): boolean {
  // Nothing known except where we are selling. Any fact about the product, the manufacturer,
  // the seller or the channel resolves to unknown, which keeps the requirement in.
  const marketOnly: EvaluationSubject = { facts: {}, market: { iso_country: isoCountry } };
  return evaluateCondition(requirement.applies_when, marketOnly).truth !== "false";
}

/** Markets a slice is worth building for. */
export function slicesFor(
  catalog: Catalog,
  isoCountries: readonly string[],
): ReadonlyMap<string, Catalog> {
  return new Map(isoCountries.map((iso) => [iso, sliceForMarket(catalog, iso)]));
}
