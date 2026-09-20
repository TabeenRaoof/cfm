/**
 * Three-valued (Kleene) logic.
 *
 * WHY THIS EXISTS AT ALL, AND WHY IT IS THE FIRST FILE IN THE PACKAGE:
 *
 * The catalog evaluates conditions like "the manufacturer is established outside the EU"
 * against product data that customers import from a spreadsheet. That spreadsheet routinely
 * does not have the column. Two-valued logic has only one place to put "I don't know", and
 * it puts it in `false` — which makes the requirement not apply, removes it from the matrix,
 * and renders the SKU green. That is a confidently wrong answer in a product whose entire job
 * is to be right about this, and it is the failure mode that would end the product.
 *
 * So there is a third value, it propagates, and it is never silently collapsed into either of
 * the other two. See tabeen_AGENTS.md "The hard rule" and decisions.md D-002.
 */

export type Truth = "true" | "false" | "unknown";

export interface TruthResult {
  readonly truth: Truth;
  /**
   * Fact paths which, if the customer supplied them, could turn an `unknown` into a decision.
   *
   * Deliberately empty whenever `truth` is decided: if a condition is already false because
   * some other branch settled it, there is nothing useful to ask the customer, and asking
   * anyway trains them to ignore the prompts.
   */
  readonly missing: readonly string[];
}

export const TRUE: TruthResult = { truth: "true", missing: [] };
export const FALSE: TruthResult = { truth: "false", missing: [] };

export function unknown(missing: readonly string[]): TruthResult {
  return { truth: "unknown", missing: dedupe(missing) };
}

/**
 * Kleene conjunction. A single `false` decides the result even when other operands are
 * unknown — "this is a toy AND we have no idea where it was made" is still not-a-toy's
 * business if the first operand is false.
 *
 * An empty conjunction is vacuously true. The loader rejects empty `all` arrays as an
 * authoring mistake, but the semantics are defined here so the behaviour is not accidental.
 */
export function and(results: readonly TruthResult[]): TruthResult {
  if (results.some((r) => r.truth === "false")) return FALSE;

  const unresolved = results.filter((r) => r.truth === "unknown");
  if (unresolved.length > 0) return unknown(unresolved.flatMap((r) => r.missing));

  return TRUE;
}

/** Kleene disjunction. A single `true` decides the result. Empty disjunction is false. */
export function or(results: readonly TruthResult[]): TruthResult {
  if (results.some((r) => r.truth === "true")) return TRUE;

  const unresolved = results.filter((r) => r.truth === "unknown");
  if (unresolved.length > 0) return unknown(unresolved.flatMap((r) => r.missing));

  return FALSE;
}

/**
 * Kleene negation. `not(unknown)` is unknown — this is the line that most often gets written
 * wrong, because in two-valued code `!undefined` is `true` and looks like it works.
 */
export function not(result: TruthResult): TruthResult {
  switch (result.truth) {
    case "true":
      return FALSE;
    case "false":
      return TRUE;
    case "unknown":
      return result;
  }
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
