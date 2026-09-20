/**
 * The `applies_when` condition language.
 *
 * Small on purpose. Every condition in the catalog is read by a human deciding whether a legal
 * obligation was encoded correctly, so the language has to be obvious on sight — and it is
 * evaluated in TypeScript, never by a model. See tabeen_AGENTS.md, "The AI never decides what
 * the law requires."
 *
 * Shape, matching the technical plan §5.1:
 *
 *   { "all": [ ... ] }                          every branch must hold
 *   { "any": [ ... ] }                          at least one branch must hold
 *   { "not": { ... } }                          negation (of unknown, stays unknown)
 *   { "always": true }                          unconditional — applies to every SKU
 *   { "market.jurisdiction": "EU" }             leaf: equality
 *   { "product.category_code": { "in": [...] }} leaf: membership
 *   { "product.gtin": { "exists": true } }      leaf: presence
 *   { "organisation.turnover_gbp": { "gte": 1000000 } }   leaf: numeric comparison
 */

import type { EvaluationSubject } from "./facts.ts";
import { resolveFact, unknownFrom } from "./facts.ts";
import type { FactValue } from "./facts.ts";
import type { TruthResult } from "./truth.ts";
import { and, FALSE, not, or, TRUE } from "./truth.ts";

export const OPERATORS = ["all", "any", "not", "always"] as const;

export type Comparison = "gte" | "gt" | "lte" | "lt";

export type Matcher =
  | FactValue
  | { readonly in: readonly FactValue[] }
  | { readonly exists: boolean }
  | { readonly [K in Comparison]?: number };

export type Condition =
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition }
  | { readonly always: true }
  | { readonly [factPath: string]: Matcher };

export function evaluateCondition(
  condition: Condition,
  subject: EvaluationSubject,
): TruthResult {
  if ("always" in condition) return TRUE;

  if ("all" in condition) {
    const branches = condition.all as readonly Condition[];
    return and(branches.map((c) => evaluateCondition(c, subject)));
  }

  if ("any" in condition) {
    const branches = condition.any as readonly Condition[];
    return or(branches.map((c) => evaluateCondition(c, subject)));
  }

  if ("not" in condition) {
    return not(evaluateCondition(condition.not as Condition, subject));
  }

  return evaluateLeaf(condition as Readonly<Record<string, Matcher>>, subject);
}

function evaluateLeaf(
  leaf: Readonly<Record<string, Matcher>>,
  subject: EvaluationSubject,
): TruthResult {
  const paths = Object.keys(leaf);
  // The loader rejects this shape before it can reach here; the throw is a backstop, because a
  // silently-ignored second key would be a wrong legal answer rather than a rendering glitch.
  if (paths.length !== 1) {
    throw new Error(
      `A condition leaf must name exactly one fact path, got ${paths.length}: ${JSON.stringify(leaf)}`,
    );
  }

  const path = paths[0] as string;
  const matcher = leaf[path] as Matcher;
  const lookup = resolveFact(path, subject);

  if (isExistsMatcher(matcher)) {
    // Unknown and known-to-be-absent are different answers to "does this exist", and only the
    // second one is an answer. See facts.ts for why the importer must keep them apart.
    if (lookup.value === undefined) return unknownFrom(lookup);
    const present = lookup.value !== null;
    return present === matcher.exists ? TRUE : FALSE;
  }

  if (lookup.value === undefined) return unknownFrom(lookup);

  if (isInMatcher(matcher)) {
    return matcher.in.includes(lookup.value) ? TRUE : FALSE;
  }

  if (isComparisonMatcher(matcher)) {
    // A threshold asked of a non-number is a data problem, not a "no". Several obligations
    // switch on turnover or tonnage, and reading a malformed figure as "under the threshold"
    // would exempt exactly the seller who needed telling.
    if (typeof lookup.value !== "number") return unknownFrom({ value: undefined, missing: [path] });
    return compare(lookup.value, matcher) ? TRUE : FALSE;
  }

  return lookup.value === matcher ? TRUE : FALSE;
}

function compare(value: number, matcher: Partial<Record<Comparison, number>>): boolean {
  if (matcher.gte !== undefined && !(value >= matcher.gte)) return false;
  if (matcher.gt !== undefined && !(value > matcher.gt)) return false;
  if (matcher.lte !== undefined && !(value <= matcher.lte)) return false;
  if (matcher.lt !== undefined && !(value < matcher.lt)) return false;
  return true;
}

/** Every fact path a condition reads, for the loader's spell-check and for gap prompts. */
export function factPathsIn(condition: Condition): readonly string[] {
  if ("always" in condition) return [];
  if ("all" in condition) {
    return (condition.all as readonly Condition[]).flatMap(factPathsIn);
  }
  if ("any" in condition) {
    return (condition.any as readonly Condition[]).flatMap(factPathsIn);
  }
  if ("not" in condition) return factPathsIn(condition.not as Condition);
  return Object.keys(condition);
}

export function isExistsMatcher(m: Matcher): m is { exists: boolean } {
  return typeof m === "object" && m !== null && "exists" in m;
}

export function isInMatcher(m: Matcher): m is { in: readonly FactValue[] } {
  return typeof m === "object" && m !== null && "in" in m;
}

export const COMPARISONS: readonly Comparison[] = ["gte", "gt", "lte", "lt"];

export function isComparisonMatcher(m: Matcher): m is Partial<Record<Comparison, number>> {
  return typeof m === "object" && m !== null && COMPARISONS.some((c) => c in m);
}
