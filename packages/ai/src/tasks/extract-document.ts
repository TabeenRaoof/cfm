/**
 * Extract the fields of a compliance document.
 *
 * The most expensive task in the product, and the one where deterministic-first pays most. Two
 * things happen before a model is involved:
 *
 *   1. @cfm/documents runs its patterns over the text layer. Labelled dates, report numbers and
 *      standard references come out with no model at all.
 *   2. The schema sent to the model is narrowed to what is left. Asking it to restate a value a
 *      regex already found spends tokens on both sides and invites it to disagree with
 *      something that was right.
 *
 * If the deterministic pass happens to cover every required field — short documents sometimes
 * oblige — no request is sent at all.
 *
 * The model never decides whether its own output is good enough. That gate is
 * `gateExtraction`, it is deterministic, and it runs on the merged result.
 */

import type { DocumentSchema } from "@cfm/documents";
import { extractDeterministically, remainingJsonSchema, schemaFor } from "@cfm/documents";
import type { DeterministicPass, FieldValue } from "@cfm/documents";

import type { TaskDefinition } from "../task.ts";

export interface ExtractInput {
  readonly documentType: string;
  readonly textLayer: string;
  /** Rendered pages, used only where there is no usable text layer. */
  readonly pages: readonly { readonly bytes: Uint8Array; readonly mime: string }[];
}

export interface ExtractOutput {
  readonly values: Readonly<Record<string, FieldValue>>;
  readonly pass: DeterministicPass;
  readonly usedModel: boolean;
}

function schemaOrThrow(documentType: string): DocumentSchema {
  const schema = schemaFor(documentType);
  if (!schema) throw new Error(`No extraction schema for document type "${documentType}".`);
  return schema;
}

export const extractDocument: TaskDefinition<ExtractInput, ExtractOutput> = {
  id: "extract_document",
  promptVersion: "2026-09-13.1",
  modelRole: "extract",
  system:
    "You read compliance documents and return only what the document states. Copy values " +
    "exactly as printed; do not normalise, translate, infer or complete them. Where the " +
    "document does not state something, return null rather than a guess — a blank field is " +
    "handled correctly downstream, an invented one is not.",

  schema: (input) => {
    const schema = schemaOrThrow(input.documentType);
    return remainingJsonSchema(schema, extractDeterministically(schema, input.textLayer));
  },

  budget: {
    // A 12-page report at roughly 1,900 image tokens a page is ~23K, and that is the worst
    // case where no text layer exists. With one, this is a few thousand.
    maxInputTokens: 30_000,
    maxOutputTokens: 1_500,
  },

  determinism: {
    kind: "deterministic-first",
    attempt: (input) => {
      const schema = schemaOrThrow(input.documentType);
      const pass = extractDeterministically(schema, input.textLayer);

      const required = schema.fields.filter((f) => f.required).map((f) => f.key);
      const resolved = new Map(pass.resolved.map((r) => [r.key, r.value]));
      const everythingRequired = required.every((key) => resolved.has(key));

      // Escalate unless the patterns covered every required field AND none of them was found by
      // a pattern whose format is unconfirmed — an unconfirmed hit is a candidate, not an answer.
      if (!everythingRequired || pass.resolved.some((r) => !r.verified) || pass.ambiguous.length > 0) {
        return undefined;
      }
      return { values: Object.fromEntries(resolved), pass, usedModel: false };
    },
    describe:
      "Pattern extraction over the document's text layer via @cfm/documents. Answers outright " +
      "only when every required field was found by a confirmed pattern with no ambiguity; " +
      "otherwise it still narrows the schema the model is asked to fill.",
  },

  prepareInput: (input) => {
    if (input.textLayer.trim() !== "") {
      const schema = schemaOrThrow(input.documentType);
      const pass = extractDeterministically(schema, input.textLayer);
      const excerpt = input.textLayer.slice(0, 60_000);

      return {
        parts: [{ type: "text", text: excerpt, cacheable: false }],
        omitted: [
          ...(pass.resolved.length > 0
            ? [`${pass.resolved.length} field(s) already resolved deterministically and not asked for`]
            : []),
          ...(input.textLayer.length > 60_000 ? ["text layer truncated"] : []),
        ],
      };
    }

    // No text layer: a scan. Page images are the only option and they are the expensive path,
    // so the budget is what stops a 200-page catalogue being sent by accident.
    return {
      parts: input.pages.map((p) => ({ type: "image" as const, bytes: p.bytes, mime: p.mime })),
      omitted: [],
    };
  },

  parse: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("extract_document returned no object.");
    }
    return {
      values: raw as Record<string, FieldValue>,
      pass: { resolved: [], remaining: [], ambiguous: [], coverage: 0 },
      usedModel: true,
    };
  },

  batchable: true,
  sampleInput: { documentType: "rp_mandate", textLayer: "", pages: [] },
};
