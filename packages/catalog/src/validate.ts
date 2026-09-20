/**
 * Catalog validation. Hand-written rather than schema-library-driven, for two reasons: the
 * package stays dependency-free so the evaluator runs from a bare `node` with no install, and
 * the error messages can name the file, the JSON path and what to do about it — which matters
 * because the person reading them is usually drafting a requirement, not debugging TypeScript.
 */

import type { Condition, Matcher } from "./dsl.ts";
import { COMPARISONS, factPathsIn, isComparisonMatcher, isExistsMatcher, isInMatcher, OPERATORS } from "./dsl.ts";
import { derivedFactPaths } from "./facts.ts";
import type { Requirement } from "./types.ts";

export interface ValidationIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

const JURISDICTIONS = new Set(["EU", "UK", "US"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const STATES = new Set(["draft", "published"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fact paths the evaluator can resolve. Anything else in an `applies_when` is a typo that
 * would evaluate to `unknown` forever and quietly park every SKU in the gap list — a failure
 * that is invisible in production precisely because `unknown` is a legitimate outcome.
 */
const KNOWN_FACT_PREFIXES = ["product.", "manufacturer.", "organisation.", "market.", "channel.", "rp.", "packaging."];

export function validateRequirement(value: unknown, file: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ file, path, message });

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    add("$", "A requirement file must contain a single JSON object.");
    return issues;
  }
  const r = value as Partial<Requirement> & Record<string, unknown>;

  requireString(r.id, "id", add);
  requireString(r.version, "version", add);
  requireString(r.regulation, "regulation", add);
  requireString(r.article_ref, "article_ref", add);
  requireString(r.title, "title", add);
  requireString(r.summary, "summary", add);

  if (!r.state || !STATES.has(r.state)) {
    add("state", `Must be one of ${[...STATES].join(", ")}.`);
  }
  if (!r.jurisdiction || !JURISDICTIONS.has(r.jurisdiction)) {
    add("jurisdiction", `Must be one of ${[...JURISDICTIONS].join(", ")}.`);
  }
  if (!r.confidence || !CONFIDENCES.has(r.confidence)) {
    add("confidence", `Must be one of ${[...CONFIDENCES].join(", ")}.`);
  }
  requireIsoDate(r.effective_from, "effective_from", add, false);
  requireIsoDate(r.effective_to ?? null, "effective_to", add, true);

  if (!r.applies_when || typeof r.applies_when !== "object") {
    add("applies_when", "Required. Use { \"always\": true } for an unconditional requirement.");
  } else {
    validateCondition(r.applies_when as Condition, "applies_when", add);
  }

  validateRequiredData(r, add);
  validateRequiredEvidence(r, add);
  validateSources(r, add);
  validatePublishGate(r, add);

  return issues;
}

function validateRequiredData(
  r: Partial<Requirement>,
  add: (p: string, m: string) => void,
): void {
  if (!Array.isArray(r.required_data)) {
    add("required_data", "Required. Use [] if the requirement needs no data fields.");
    return;
  }
  r.required_data.forEach((d, i) => {
    requireString(d?.key, `required_data[${i}].key`, add);
    requireString(d?.label, `required_data[${i}].label`, add);
    if (typeof d?.key === "string") checkFactPath(d.key, `required_data[${i}].key`, add);
  });
}

function validateRequiredEvidence(
  r: Partial<Requirement>,
  add: (p: string, m: string) => void,
): void {
  if (!Array.isArray(r.required_evidence)) {
    add("required_evidence", "Required. Use [] if the requirement needs no documents.");
    return;
  }
  r.required_evidence.forEach((e, i) => {
    requireString(e?.type, `required_evidence[${i}].type`, add);
    requireString(e?.label, `required_evidence[${i}].label`, add);
    if (typeof e?.expires !== "boolean") {
      add(`required_evidence[${i}].expires`, "Required boolean — does this document go stale?");
    }
  });
}

function validateSources(r: Partial<Requirement>, add: (p: string, m: string) => void): void {
  if (!Array.isArray(r.sources) || r.sources.length === 0) {
    add("sources", "At least one primary source is required, even on a draft.");
    return;
  }
  r.sources.forEach((s, i) => {
    requireString(s?.title, `sources[${i}].title`, add);
    requireString(s?.url, `sources[${i}].url`, add);
    if (typeof s?.verified !== "boolean") {
      add(`sources[${i}].verified`, "Required boolean — has a human opened this and read it?");
    }
    if (s?.retrieved_at != null) requireIsoDate(s.retrieved_at, `sources[${i}].retrieved_at`, add, false);
  });
}

/**
 * The publish gate (decisions.md D-008). A requirement only reaches customers once somebody
 * has read the primary source and put their name on it. This is the check that stops the
 * catalog filling up with plausible, uncited, model-written regulation.
 */
function validatePublishGate(r: Partial<Requirement>, add: (p: string, m: string) => void): void {
  if (r.state !== "published") return;

  if (!r.reviewer) {
    add("reviewer", "A published requirement needs a named reviewer. Drafts may leave it null.");
  }
  if (!r.last_reviewed_at) {
    add("last_reviewed_at", "A published requirement needs a review date.");
  } else {
    requireIsoDate(r.last_reviewed_at, "last_reviewed_at", add, false);
  }
  const sources = Array.isArray(r.sources) ? r.sources : [];
  if (!sources.some((s) => s?.verified === true && s?.retrieved_at)) {
    add(
      "sources",
      "A published requirement needs at least one source with verified: true and a retrieved_at date.",
    );
  }
}

function validateCondition(
  condition: Condition,
  path: string,
  add: (p: string, m: string) => void,
): void {
  if (typeof condition !== "object" || condition === null || Array.isArray(condition)) {
    add(path, "A condition must be an object.");
    return;
  }
  const keys = Object.keys(condition);
  if (keys.length !== 1) {
    add(path, `A condition must have exactly one key, got ${keys.length}: ${keys.join(", ")}.`);
    return;
  }
  const key = keys[0] as string;

  if (key === "always") {
    if ((condition as { always: unknown }).always !== true) {
      add(`${path}.always`, "Only { \"always\": true } is meaningful.");
    }
    return;
  }

  if (key === "all" || key === "any") {
    const branches = (condition as Record<string, unknown>)[key];
    if (!Array.isArray(branches) || branches.length === 0) {
      // An empty `all` is vacuously true and an empty `any` vacuously false. Both are almost
      // always an unfinished edit rather than an intention, and both are silent in production.
      add(`${path}.${key}`, "Must be a non-empty array of conditions.");
      return;
    }
    branches.forEach((b, i) => validateCondition(b as Condition, `${path}.${key}[${i}]`, add));
    return;
  }

  if (key === "not") {
    validateCondition((condition as { not: Condition }).not, `${path}.not`, add);
    return;
  }

  checkFactPath(key, path, add);
  validateMatcher((condition as Record<string, Matcher>)[key] as Matcher, `${path}.${key}`, add);
}

function validateMatcher(matcher: Matcher, path: string, add: (p: string, m: string) => void): void {
  if (isInMatcher(matcher)) {
    if (!Array.isArray(matcher.in) || matcher.in.length === 0) {
      add(path, "`in` must be a non-empty array.");
    }
    return;
  }
  if (isExistsMatcher(matcher)) {
    if (typeof matcher.exists !== "boolean") add(path, "`exists` must be a boolean.");
    return;
  }
  if (isComparisonMatcher(matcher)) {
    for (const key of COMPARISONS) {
      const bound = matcher[key];
      if (bound !== undefined && typeof bound !== "number") {
        add(`${path}.${key}`, "A comparison bound must be a number.");
      }
    }
    return;
  }
  const t = typeof matcher;
  if (matcher !== null && t !== "string" && t !== "number" && t !== "boolean") {
    add(
      path,
      "A leaf matcher must be a string, number, boolean, null, {in:[...]}, {exists:bool}, " +
        "or a numeric comparison such as {gte:1000000}.",
    );
  }
}

function checkFactPath(factPath: string, path: string, add: (p: string, m: string) => void): void {
  if (OPERATORS.includes(factPath as (typeof OPERATORS)[number])) {
    add(path, `"${factPath}" is a reserved operator and cannot be used as a fact path.`);
    return;
  }
  const derived = derivedFactPaths();
  if (derived.includes(factPath)) return;
  if (!KNOWN_FACT_PREFIXES.some((p) => factPath.startsWith(p))) {
    add(
      path,
      `Unrecognised fact path "${factPath}". Expected one of the derived facts ` +
        `(${derived.join(", ")}) or a path beginning ${KNOWN_FACT_PREFIXES.join(", ")}.`,
    );
  }
}

/** Every fact path this requirement depends on — used by the hard-rule test. */
export function decidingFactPaths(requirement: Requirement): readonly string[] {
  return [...new Set(factPathsIn(requirement.applies_when))];
}

function requireString(v: unknown, path: string, add: (p: string, m: string) => void): void {
  if (typeof v !== "string" || v.trim() === "") add(path, "Required, non-empty string.");
}

function requireIsoDate(
  v: unknown,
  path: string,
  add: (p: string, m: string) => void,
  nullable: boolean,
): void {
  if (v === null || v === undefined) {
    if (!nullable) add(path, "Required date in YYYY-MM-DD form.");
    return;
  }
  if (typeof v !== "string" || !ISO_DATE.test(v)) add(path, "Must be a date in YYYY-MM-DD form.");
}
