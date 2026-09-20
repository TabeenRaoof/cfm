/**
 * Deterministic field extraction from a document's text layer.
 *
 * This is the field-level version of the rule in @cfm/ai: if code can answer, code answers.
 * Compliance documents are formulaic — a labelled date, a registration number with a fixed
 * shape, a report number beside the words "Report No." — and a regex that finds one costs
 * nothing, gives the same answer every time, and can be shown to an auditor. A model call can
 * do none of those things.
 *
 * The payoff is not only cost. Every field resolved here is one the model is not asked for, so
 * the prompt shrinks, the output shrinks, and the remaining questions are the ones that
 * genuinely need reading comprehension.
 *
 * TWO RULES THAT KEEP THIS HONEST
 *
 * 1. `verified: false` means the format was inferred, not confirmed against a real document or
 *    a published specification. An unverified pattern yields a *candidate*: it is recorded, it
 *    saves the model from guessing blind, but it never auto-accepts. Same discipline as a draft
 *    requirement.
 * 2. A pattern that matches more than once does not pick one. Two plausible issue dates on a
 *    page is exactly when a human should look, and choosing the first would be free and wrong.
 */

export interface ExtractionPattern {
  readonly id: string;
  readonly fieldKey: string;
  readonly regex: RegExp;
  /** Which capture group holds the value. */
  readonly group: number;
  readonly verified: boolean;
  readonly note: string;
  /** Applied to the captured text before validation, e.g. date normalisation. */
  readonly normalise?: (raw: string) => string | null;
}

/**
 * DD.MM.YYYY, DD/MM/YYYY and YYYY-MM-DD to ISO.
 *
 * The separator carries information, and treating both the same throws it away. A dot is
 * European convention — 14.03.2026 — and US documents do not use it, so a dot-separated date is
 * read as day-first. A slash is used by both, so `03/04/2026` is 3 April in Europe and 4 March
 * in the US. Where the reading changes the answer we decline rather than pick, and the field
 * goes to a human.
 *
 * That is a heuristic about convention, not a rule about data, which is why the ambiguous case
 * returns null instead of a best guess.
 */
export function normaliseDate(raw: string): string | null {
  const text = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return text;

  const separated = /^(\d{1,2})([./])(\d{1,2})[./](\d{4})$/.exec(text);
  if (!separated) return null;

  const [, first, separator, second, year] = separated;
  const day = Number(first), month = Number(second);

  if (separator === "/" && day <= 12 && month <= 12 && day !== month) return null;
  if (month > 12 || day > 31 || month < 1 || day < 1) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const PATTERNS: readonly ExtractionPattern[] = [
  {
    id: "issue_date_labelled",
    fieldKey: "issue_date",
    regex: /(?:date of issue|issue date|issued on|signed on|signed|date d['’]émission|signé le|ausstellungsdatum|unterzeichnet am|datum)\s*[:\-\s]{0,4}(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})/gi,
    group: 1,
    verified: true,
    note: "A labelled date is unambiguous about which date it is; the label carries the meaning. " +
      "'signed on' / 'signed' covers RP mandates, which are dated by signature rather than issue " +
      "— found live: an Anthropic smoke test on a real mandate phrasing escalated to the model " +
      "for a date this pattern should have resolved for free.",
    normalise: normaliseDate,
  },
  {
    id: "report_number_labelled",
    fieldKey: "report_number",
    regex: /(?:report\s*(?:no|number|nr)|prüfbericht\s*nr|rapport\s*n[o°])\s*[.:\-\s]{0,4}([A-Z0-9][A-Z0-9\-/.]{3,30})/gi,
    group: 1,
    verified: true,
    note: "Report numbers vary in format but are reliably labelled.",
  },
  {
    id: "lucid_number",
    fieldKey: "registration_number",
    regex: /\bDE\s?(\d{10,16})\b/g,
    group: 0,
    verified: false,
    note:
      "German LUCID registration numbers begin DE followed by digits. The exact digit count was " +
      "NOT confirmed against the ZSVR's specification, so this is a candidate only — it flags a " +
      "likely number for a human rather than accepting one.",
  },
  {
    id: "eu_vat_number",
    fieldKey: "vat_number",
    regex: /\b((?:AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|EL|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE)[0-9A-Z]{8,12})\b/g,
    group: 1,
    verified: false,
    note:
      "Per-country VAT formats differ in length and checksum and none is validated here. A match " +
      "is a candidate; confirming it needs the per-country rules or a VIES lookup.",
  },
  {
    id: "standard_reference",
    fieldKey: "standards",
    regex: /\b((?:EN|IEC|ISO)(?:\s+(?:EN|IEC|ISO))*\s+[\dA-Za-z.\-]+(?::\d{4})?(?:\s*\+\s*A\d+(?::\d{4})?)*)/g,
    group: 1,
    verified: true,
    note: "Standard references have a stable published shape and parse structurally.",
  },
];

export interface PatternHit {
  readonly patternId: string;
  readonly fieldKey: string;
  readonly value: string;
  readonly verified: boolean;
  readonly note: string;
}

export interface PatternOutcome {
  /** Exactly one distinct match: usable. */
  readonly hits: readonly PatternHit[];
  /** More than one distinct match: deliberately not resolved. */
  readonly ambiguous: readonly { readonly fieldKey: string; readonly candidates: readonly string[] }[];
}

export function runPatterns(text: string, patterns: readonly ExtractionPattern[] = PATTERNS): PatternOutcome {
  const byField = new Map<string, { pattern: ExtractionPattern; values: Set<string> }>();

  for (const pattern of patterns) {
    // A global regex carries lastIndex between calls; a fresh one per document avoids the
    // classic bug where the second document in a batch silently matches nothing.
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    const values = new Set<string>();

    for (const match of text.matchAll(regex)) {
      const captured = match[pattern.group];
      if (captured === undefined) continue;
      const value = pattern.normalise ? pattern.normalise(captured) : captured.trim();
      if (value) values.add(value);
    }
    if (values.size === 0) continue;

    const existing = byField.get(pattern.fieldKey);
    if (existing) for (const v of values) existing.values.add(v);
    else byField.set(pattern.fieldKey, { pattern, values });
  }

  const hits: PatternHit[] = [];
  const ambiguous: { fieldKey: string; candidates: string[] }[] = [];

  for (const [fieldKey, { pattern, values }] of byField) {
    const candidates = [...values];
    // `standards` is genuinely a list; everything else having two values means we cannot tell.
    if (fieldKey === "standards") {
      for (const value of candidates) {
        hits.push({ patternId: pattern.id, fieldKey, value, verified: pattern.verified, note: pattern.note });
      }
    } else if (candidates.length === 1) {
      hits.push({
        patternId: pattern.id,
        fieldKey,
        value: candidates[0] as string,
        verified: pattern.verified,
        note: pattern.note,
      });
    } else {
      ambiguous.push({ fieldKey, candidates: candidates.sort() });
    }
  }

  return { hits, ambiguous };
}
