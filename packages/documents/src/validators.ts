/**
 * Deterministic validation of extracted values.
 *
 * Nothing here calls a model, and nothing here guesses. A validator has exactly three possible
 * answers — valid, invalid with a reason, or "not enough to judge" — and the third is not the
 * same as valid. That is the same three-valued discipline the catalog runs on, applied one
 * layer down: a field we cannot check is not a field that passed.
 *
 * These catch the failures that matter commercially: a report dated after today, an expiry
 * before its issue date, a country code that is not one, a standard reference that does not
 * parse. Every one of them is a sign the document is wrong, misread, or fabricated — and every
 * one is cheaper to catch here than in front of a customer.
 */

export type Verdict = "valid" | "invalid" | "undetermined";

export interface ValidationResult {
  readonly verdict: Verdict;
  readonly reason?: string;
}

const VALID: ValidationResult = { verdict: "valid" };
const UNDETERMINED: ValidationResult = { verdict: "undetermined" };

function invalid(reason: string): ValidationResult {
  return { verdict: "invalid", reason };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A real calendar date in ISO form. `2026-02-30` matches the pattern and is not a date;
 * Date.parse would roll it forward to 2 March silently, which is how a wrong expiry becomes a
 * plausible one.
 */
export function validateDate(value: unknown): ValidationResult {
  if (value === null || value === undefined || value === "") return UNDETERMINED;
  if (typeof value !== "string") return invalid("Not a date.");

  const match = ISO_DATE.exec(value);
  if (!match) return invalid(`"${value}" is not a date in YYYY-MM-DD form.`);

  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return invalid(`"${value}" is not a real calendar date.`);
  }
  return VALID;
}

/**
 * `asOf` is a parameter rather than today's date, so the check is testable and so a
 * re-evaluation of an old document does not change its verdict depending on when it runs.
 */
export function validateIssueDate(value: unknown, asOf: string, oldestPlausibleYears = 25): ValidationResult {
  const shape = validateDate(value);
  if (shape.verdict !== "valid") return shape;

  const issued = value as string;
  if (issued > asOf) {
    // A document dated in the future is either a typo, a misread, or a forgery. All three want
    // a human.
    return invalid(`Issued ${issued}, which is in the future as at ${asOf}.`);
  }

  const oldest = `${Number(asOf.slice(0, 4)) - oldestPlausibleYears}${asOf.slice(4)}`;
  if (issued < oldest) {
    return invalid(`Issued ${issued}, more than ${oldestPlausibleYears} years before ${asOf}.`);
  }
  return VALID;
}

export function validateValidityWindow(from: unknown, to: unknown): ValidationResult {
  const fromShape = validateDate(from);
  const toShape = validateDate(to);
  if (fromShape.verdict === "invalid") return fromShape;
  if (toShape.verdict === "invalid") return toShape;
  if (fromShape.verdict !== "valid" || toShape.verdict !== "valid") return UNDETERMINED;

  return (to as string) > (from as string)
    ? VALID
    : invalid(`Valid-to ${String(to)} is not after valid-from ${String(from)}.`);
}

/** ISO 3166-1 alpha-2 shape. Membership of a specific list belongs to the catalog, not here. */
export function validateCountry(value: unknown): ValidationResult {
  if (value === null || value === undefined || value === "") return UNDETERMINED;
  if (typeof value !== "string") return invalid("Not a country code.");
  return /^[A-Z]{2}$/.test(value)
    ? VALID
    : invalid(`"${value}" is not an ISO 3166-1 alpha-2 code such as DE.`);
}

export interface ParsedStandard {
  readonly body: string;
  readonly number: string;
  readonly year: number | null;
  readonly amendments: readonly string[];
  readonly raw: string;
}

/**
 * Parse a standard reference such as `EN 71-1:2014+A1:2018` or `EN IEC 62368-1:2020`.
 *
 * Structured rather than stored as a string because the v2 verification module (`02-` §7) has
 * to compare cited versions against a table of current ones and withdrawal dates. That
 * comparison is impossible on free text, and doing the parsing now means the extraction data
 * model does not have to change later.
 */
export function parseStandard(raw: string): ParsedStandard | null {
  const text = raw.trim().replace(/\s+/g, " ");
  const match = /^((?:EN|IEC|ISO|ASTM|BS|DIN|UL)(?:\s+(?:EN|IEC|ISO))*)\s+([\dA-Za-z.\-]+)(?::(\d{4}))?((?:\s*\+\s*A\d+(?::\d{4})?)*)$/.exec(text);
  if (!match) return null;

  const [, body, number, year, amendmentPart] = match;
  const amendments = (amendmentPart ?? "")
    .split("+")
    .map((a) => a.trim())
    .filter((a) => a !== "");

  return {
    body: (body ?? "").replace(/\s+/g, " "),
    number: number ?? "",
    year: year ? Number(year) : null,
    amendments,
    raw: text,
  };
}

export function validateStandard(value: unknown): ValidationResult {
  if (value === null || value === undefined || value === "") return UNDETERMINED;
  if (typeof value !== "string") return invalid("Not a standard reference.");
  return parseStandard(value)
    ? VALID
    : invalid(`"${value}" does not parse as a standard reference such as EN 71-1:2014+A1:2018.`);
}
