/**
 * The deterministic extraction pass, and the decision about what is left for a model.
 *
 * This runs before any model call. What it resolves, the model is never asked for — which is
 * where the token saving actually comes from: not a shorter prompt, but fewer questions.
 */

import type { DocumentSchema, FieldDefinition } from "./field.ts";
import type { PatternHit } from "./patterns.ts";
import { runPatterns } from "./patterns.ts";

export type FieldValue = string | number | readonly string[] | null;

export interface ResolvedField {
  readonly key: string;
  readonly value: FieldValue;
  readonly source: "pattern";
  readonly patternId: string;
  /** False when the pattern's format was inferred rather than confirmed. Forces review. */
  readonly verified: boolean;
}

export interface DeterministicPass {
  readonly resolved: readonly ResolvedField[];
  /** Field keys the model still has to answer. */
  readonly remaining: readonly string[];
  /** Fields where more than one plausible value was found, so nothing was chosen. */
  readonly ambiguous: readonly { readonly fieldKey: string; readonly candidates: readonly string[] }[];
  /** Rough share of the schema answered without a model. Reported in the admin cost view. */
  readonly coverage: number;
}

export function extractDeterministically(schema: DocumentSchema, textLayer: string): DeterministicPass {
  if (textLayer.trim() === "") {
    // A scan with no text layer. Nothing here can help, and saying so plainly is better than
    // returning an empty result that looks like "found nothing of interest".
    return { resolved: [], remaining: schema.fields.map((f) => f.key), ambiguous: [], coverage: 0 };
  }

  const { hits, ambiguous } = runPatterns(textLayer);
  const wanted = new Set(schema.fields.filter((f) => f.pattern).map((f) => f.key));
  const relevant = hits.filter((h) => wanted.has(h.fieldKey));

  const resolved = collapse(schema, relevant);
  const resolvedKeys = new Set(resolved.map((r) => r.key));

  return {
    resolved,
    remaining: schema.fields.map((f) => f.key).filter((k) => !resolvedKeys.has(k)),
    ambiguous: ambiguous.filter((a) => wanted.has(a.fieldKey)),
    coverage: schema.fields.length === 0 ? 0 : resolved.length / schema.fields.length,
  };
}

function collapse(schema: DocumentSchema, hits: readonly PatternHit[]): ResolvedField[] {
  const byField = new Map<string, PatternHit[]>();
  for (const hit of hits) {
    byField.set(hit.fieldKey, [...(byField.get(hit.fieldKey) ?? []), hit]);
  }

  const resolved: ResolvedField[] = [];
  for (const [key, fieldHits] of byField) {
    const field = schema.fields.find((f) => f.key === key);
    if (!field) continue;
    const first = fieldHits[0];
    if (!first) continue;

    resolved.push({
      key,
      value: field.kind === "string_array" ? fieldHits.map((h) => h.value) : first.value,
      source: "pattern",
      patternId: first.patternId,
      verified: fieldHits.every((h) => h.verified),
    });
  }
  return resolved;
}

/**
 * The schema to send a model, narrowed to what is still unanswered.
 *
 * Required fields that were already resolved are dropped from `required` as well as from
 * `properties` — asking a model to restate a value we already hold spends tokens on both sides
 * and invites it to disagree with a regex that was right.
 */
export function remainingJsonSchema(
  schema: DocumentSchema,
  pass: DeterministicPass,
): Record<string, unknown> {
  const remaining = new Set(pass.remaining);
  const fields = schema.fields.filter((f) => remaining.has(f.key));

  return {
    type: "object",
    additionalProperties: false,
    required: fields.filter((f) => f.required).map((f) => f.key),
    properties: Object.fromEntries(fields.map((f) => [f.key, describeForModel(f)])),
  };
}

function describeForModel(field: FieldDefinition): Record<string, unknown> {
  switch (field.kind) {
    case "date":
      return { type: ["string", "null"], description: `${field.description} Format YYYY-MM-DD.` };
    case "country":
      return { type: ["string", "null"], description: `${field.description} ISO 3166-1 alpha-2.` };
    case "number":
      return { type: ["number", "null"], description: field.description };
    case "enum":
      return { type: "string", enum: field.values ?? [], description: field.description };
    case "string_array":
      return { type: "array", items: { type: "string" }, description: field.description };
    case "string":
      return { type: ["string", "null"], description: field.description };
  }
}
