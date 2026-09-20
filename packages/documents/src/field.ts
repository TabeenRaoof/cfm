/**
 * Field definitions for extracted documents.
 *
 * A field is declared once, here, and three things are derived from that declaration rather
 * than written three times: the JSON Schema a model is asked to fill, the deterministic
 * validators that check whatever comes back, and the review card a human sees when something
 * fails. Written separately they drift — the schema says a date is optional, the validator
 * insists on it, and the review UI asks for something neither mentions.
 */

export type FieldKind = "string" | "date" | "country" | "number" | "enum" | "string_array";

export interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Required fields gate auto-acceptance; optional ones never block it. */
  readonly required: boolean;
  readonly description: string;
  readonly values?: readonly string[];
  /**
   * A pattern that can find this field in a document's text layer with no model involved.
   * Deterministic-first, at the field level: see patterns.ts for why `verified` matters.
   */
  readonly pattern?: PatternRef;
}

export interface PatternRef {
  readonly id: string;
  /**
   * False when the format was inferred rather than confirmed against a real document or a
   * published specification. An unverified pattern produces a *candidate* that still goes to
   * review; it never auto-accepts. Same discipline as a draft requirement.
   */
  readonly verified: boolean;
}

export interface DocumentSchema {
  readonly type: string;
  readonly label: string;
  readonly fields: readonly FieldDefinition[];
}

/**
 * The JSON Schema handed to a model. Derived, never hand-written, so the model is asked for
 * exactly what the validators will check.
 *
 * `additionalProperties: false` matters beyond tidiness: providers differ in how much they
 * volunteer, and a closed schema is what makes two vendors' output comparable (see the
 * portability tests in @cfm/ai).
 */
export function toJsonSchema(schema: DocumentSchema): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: schema.fields.filter((f) => f.required).map((f) => f.key),
    properties: Object.fromEntries(schema.fields.map((f) => [f.key, propertyFor(f)])),
  };
}

function propertyFor(field: FieldDefinition): Record<string, unknown> {
  const base = { description: field.description };

  switch (field.kind) {
    case "date":
      return { ...base, type: ["string", "null"], format: "date",
               description: `${field.description} Format YYYY-MM-DD. Null if not stated.` };
    case "country":
      return { ...base, type: ["string", "null"],
               description: `${field.description} ISO 3166-1 alpha-2, e.g. DE. Null if not stated.` };
    case "number":
      return { ...base, type: ["number", "null"] };
    case "enum":
      return { ...base, type: "string", enum: field.values ?? [] };
    case "string_array":
      return { ...base, type: "array", items: { type: "string" } };
    case "string":
      return { ...base, type: ["string", "null"] };
  }
}
