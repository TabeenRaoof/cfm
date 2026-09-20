/**
 * The confidence gate (`02-` §6.4): does this extraction go straight into the evidence vault,
 * or in front of a human first?
 *
 * Entirely deterministic. No model scores its own work — a self-reported confidence is the one
 * number a model has no way to calibrate, and treating it as a gate would mean the same
 * component decides both the answer and whether the answer is good enough.
 *
 * Auto-acceptance is the exception, not the default. It requires all of:
 *   - every required field present
 *   - every validator that could judge, judging it valid
 *   - nothing resolved by a pattern whose format is unconfirmed
 *   - nothing where two plausible values were found
 *
 * Anything else produces a review card. This errs towards human time on purpose: an extraction
 * accepted wrongly becomes evidence behind a green cell, and the whole product rests on a green
 * cell meaning something.
 */

import type { DocumentSchema, FieldDefinition } from "./field.ts";
import type { DeterministicPass, FieldValue } from "./extract.ts";
import type { ValidationResult } from "./validators.ts";
import { validateCountry, validateDate, validateIssueDate, validateStandard, validateValidityWindow } from "./validators.ts";

export type FieldSource = "pattern" | "model" | "absent";

export interface FieldOutcome {
  readonly key: string;
  readonly label: string;
  readonly value: FieldValue;
  readonly source: FieldSource;
  readonly required: boolean;
  readonly validation: ValidationResult;
  /** True when a pattern found it but the pattern's format is unconfirmed. */
  readonly needsConfirmation: boolean;
}

export interface ExtractionVerdict {
  readonly decision: "accept" | "review";
  /** Why review is needed. Empty when accepted. These are the review card's headings. */
  readonly reasons: readonly string[];
  readonly fields: readonly FieldOutcome[];
  readonly missingRequired: readonly string[];
  readonly invalidFields: readonly string[];
}

export interface GateInput {
  readonly schema: DocumentSchema;
  readonly pass: DeterministicPass;
  /** Whatever a model returned for the remaining fields. Empty when none was called. */
  readonly modelValues: Readonly<Record<string, FieldValue | undefined>>;
  readonly asOf: string;
}

export function gateExtraction(input: GateInput): ExtractionVerdict {
  const { schema, pass, modelValues, asOf } = input;
  const resolvedByPattern = new Map(pass.resolved.map((r) => [r.key, r]));
  const ambiguousFields = new Set(pass.ambiguous.map((a) => a.fieldKey));

  const fields: FieldOutcome[] = schema.fields.map((field) => {
    const fromPattern = resolvedByPattern.get(field.key);
    const value = fromPattern ? fromPattern.value : (modelValues[field.key] ?? null);
    const source: FieldSource = fromPattern ? "pattern" : field.key in modelValues ? "model" : "absent";

    return {
      key: field.key,
      label: field.label,
      value,
      source,
      required: field.required,
      validation: validateField(field, value, modelValues, resolvedByPattern, asOf),
      needsConfirmation: fromPattern ? !fromPattern.verified : false,
    };
  });

  const missingRequired = fields
    .filter((f) => f.required && isEmpty(f.value))
    .map((f) => f.key);
  const invalidFields = fields.filter((f) => f.validation.verdict === "invalid").map((f) => f.key);
  const unconfirmed = fields.filter((f) => f.needsConfirmation).map((f) => f.key);

  const reasons: string[] = [];
  if (missingRequired.length > 0) {
    reasons.push(`Required field(s) not found: ${missingRequired.join(", ")}.`);
  }
  for (const field of fields) {
    if (field.validation.verdict === "invalid") {
      reasons.push(`${field.label}: ${field.validation.reason ?? "failed validation"}`);
    }
  }
  if (unconfirmed.length > 0) {
    reasons.push(
      `Found by a pattern whose format is not confirmed, so needs a look: ${unconfirmed.join(", ")}.`,
    );
  }
  for (const { fieldKey, candidates } of pass.ambiguous) {
    reasons.push(`${fieldKey}: more than one plausible value (${candidates.join(", ")}), so none was chosen.`);
  }

  return {
    decision: reasons.length === 0 ? "accept" : "review",
    reasons,
    fields,
    missingRequired,
    invalidFields: [...new Set([...invalidFields, ...ambiguousFields])],
  };
}

function validateField(
  field: FieldDefinition,
  value: FieldValue,
  modelValues: Readonly<Record<string, FieldValue | undefined>>,
  resolved: ReadonlyMap<string, { value: FieldValue }>,
  asOf: string,
): ValidationResult {
  if (field.kind === "date") {
    // An issue date gets the stronger check — not in the future, not implausibly old — because
    // a wrong one is a signal about the document rather than a formatting slip.
    const base = field.key === "issue_date" ? validateIssueDate(value, asOf) : validateDate(value);
    if (base.verdict === "invalid") return base;

    if (field.key === "valid_to") {
      const from = resolved.get("issue_date")?.value ?? modelValues["issue_date"] ?? null;
      const window = validateValidityWindow(from, value);
      if (window.verdict === "invalid") return window;
    }
    return base;
  }

  if (field.kind === "country") return validateCountry(value);

  if (field.key === "standards" && Array.isArray(value)) {
    for (const entry of value) {
      const result = validateStandard(entry);
      if (result.verdict === "invalid") return result;
    }
    return value.length > 0 ? { verdict: "valid" } : { verdict: "undetermined" };
  }

  if (field.kind === "enum") {
    if (isEmpty(value)) return { verdict: "undetermined" };
    return (field.values ?? []).includes(String(value))
      ? { verdict: "valid" }
      : { verdict: "invalid", reason: `"${String(value)}" is not one of ${(field.values ?? []).join(", ")}.` };
  }

  // Nothing deterministic can judge free text. "Undetermined" is not "valid" — it only avoids
  // blocking acceptance on a field no rule could ever check.
  return isEmpty(value) ? { verdict: "undetermined" } : { verdict: "undetermined" };
}

function isEmpty(value: FieldValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
