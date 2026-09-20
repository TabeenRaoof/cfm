/**
 * Classify an uploaded document.
 *
 * A worked example of deterministic-first, and the reason the rule is worth enforcing: most
 * compliance documents announce what they are, in large type, on page one, in a text layer
 * that a PDF already carries. A regex over that text costs nothing, returns the same answer
 * every time, and is auditable — three things a model call is not.
 *
 * The model is the fallback for scans with no text layer and for documents that are genuinely
 * ambiguous. Every classification that never reaches it is roughly $0.007 saved and, more
 * importantly, one less non-deterministic step in a chain a customer may have to defend to an
 * authority.
 *
 * The attempt escalates rather than guessing. Two matching document types means the model
 * decides; a supplier who staples a declaration of conformity to a test report is common, and
 * picking the first match would be wrong roughly half the time.
 */

import type { TaskDefinition } from "../task.ts";

export type DocumentType =
  | "test_report"
  | "declaration_of_conformity"
  | "rp_mandate"
  | "epr_certificate"
  | "material_declaration"
  | "label_artwork"
  | "invoice_or_spec"
  | "other";

export interface ClassifyInput {
  readonly filename: string;
  /** The PDF's text layer, empty for a scan. */
  readonly textLayer: string;
  /** Rendered first pages, used only when the text layer is empty. */
  readonly firstPages: readonly { readonly bytes: Uint8Array; readonly mime: string }[];
}

export interface Classification {
  readonly type: DocumentType;
  readonly evidence: string;
}

/**
 * Phrases that identify a document type. Multilingual because the documents are: a Shenzhen
 * lab issues in English and Chinese, a German scheme in German, a French eco-organisme in
 * French. Kept as plain strings rather than a model prompt so that adding a language is a
 * one-line change with a test, not a prompt revision and an eval run.
 */
const SIGNATURES: ReadonlyArray<readonly [DocumentType, readonly string[]]> = [
  ["test_report", ["test report", "prüfbericht", "rapport d'essai", "检测报告", "试验报告", "report no", "test result"]],
  ["declaration_of_conformity", ["declaration of conformity", "konformitätserklärung", "déclaration de conformité", "符合性声明", "eu declaration"]],
  ["rp_mandate", ["mandate", "letter of appointment", "authorised representative agreement", "responsible person agreement", "beauftragung"]],
  ["epr_certificate", ["lucid", "verpackungsregister", "citeo", "eco-organisme", "identifiant unique", "packaging register", "producer registration"]],
  ["material_declaration", ["material declaration", "rohs", "reach", "svhc", "materialerklärung", "物质声明"]],
  ["label_artwork", ["artwork", "label proof", "druckvorlage", "triman", "info-tri"]],
  ["invoice_or_spec", ["invoice", "proforma", "packing list", "rechnung", "facture", "specification sheet"]],
];

export function classifyDeterministically(input: ClassifyInput): Classification | undefined {
  const haystack = `${input.filename}\n${input.textLayer}`.toLowerCase();
  if (haystack.trim() === "") return undefined;

  const hits: { type: DocumentType; phrase: string }[] = [];
  for (const [type, phrases] of SIGNATURES) {
    const phrase = phrases.find((p) => haystack.includes(p));
    if (phrase) hits.push({ type, phrase });
  }

  // Exactly one match is a confident answer. Zero or several is a question for the model —
  // guessing here would be free and wrong, which is the worst combination available.
  const first = hits[0];
  if (hits.length !== 1 || !first) return undefined;

  return { type: first.type, evidence: `matched "${first.phrase}"` };
}

export const classifyDocument: TaskDefinition<ClassifyInput, Classification> = {
  id: "classify_document",
  promptVersion: "2026-09-12.1",
  modelRole: "classify",
  system:
    "You identify what kind of compliance document this is. Answer with one of the given " +
    "types and a short quotation from the document as evidence. If it is none of them, " +
    "answer \"other\". Do not infer from the product, only from the document itself.",
  schema: () => ({
    type: "object",
    additionalProperties: false,
    required: ["type", "evidence"],
    properties: {
      type: {
        type: "string",
        enum: [
          "test_report", "declaration_of_conformity", "rp_mandate", "epr_certificate",
          "material_declaration", "label_artwork", "invoice_or_spec", "other",
        ],
      },
      evidence: { type: "string", maxLength: 200 },
    },
  }),
  budget: {
    // Two pages is enough to tell a test report from a mandate; twelve is not four times
    // better, it is four times the price. The budget is the enforcement of that judgement.
    maxInputTokens: 6_000,
    maxOutputTokens: 120,
  },
  determinism: {
    kind: "deterministic-first",
    attempt: classifyDeterministically,
    describe:
      "Phrase match over the filename and PDF text layer, in EN/DE/FR/ZH. Escalates when zero " +
      "or more than one document type matches.",
  },
  prepareInput: (input) => {
    // Prefer the text layer: a page of text is a few hundred tokens, a page image a couple of
    // thousand. Images are sent only when there is no text at all.
    if (input.textLayer.trim() !== "") {
      const excerpt = input.textLayer.slice(0, 4_000);
      return {
        parts: [{ type: "text", text: excerpt }],
        omitted:
          input.textLayer.length > 4_000
            ? [`text layer truncated to the first 4,000 characters of ${input.textLayer.length}`]
            : [],
      };
    }
    const pages = input.firstPages.slice(0, 2);
    return {
      parts: pages.map((p) => ({ type: "image" as const, bytes: p.bytes, mime: p.mime })),
      omitted:
        input.firstPages.length > 2
          ? [`only the first 2 of ${input.firstPages.length} rendered pages were sent`]
          : [],
    };
  },
  parse: (raw) => {
    const value = raw as Partial<Classification>;
    if (typeof value?.type !== "string") {
      throw new Error("classify_document returned no type.");
    }
    return { type: value.type as DocumentType, evidence: value.evidence ?? "" };
  },
  batchable: true,
  sampleInput: { filename: "report.pdf", textLayer: "", firstPages: [] },
};
