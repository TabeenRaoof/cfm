/**
 * Document processing: an uploaded file in, a gated extraction out (D-051). Runs in the Worker's
 * queue consumer; written against small interfaces so every branch is tested without Cloudflare,
 * Supabase or a paid model (test/process.test.ts).
 *
 * Deterministic first, as everywhere (D-016): the uploader declares the document type (no
 * classification call); the text layer is read locally (unpdf); @cfm/documents' patterns answer
 * what they can; the model is asked only for what is left, inside extract_document's token budget;
 * and the model never decides whether its output is good enough — `gateExtraction` does.
 */

import { BudgetExceededError, extractDocument, type Gateway, type UsageRecord } from "@cfm/ai";
import {
  extractDeterministically,
  gateExtraction,
  schemaFor,
  type DeterministicPass,
  type ExtractionVerdict,
  type FieldValue,
} from "@cfm/documents";

export type DocumentStatus = "queued" | "processing" | "accepted" | "needs_review" | "failed";

export interface StoredDocument {
  readonly id: string;
  readonly organisation_id: string;
  readonly doc_type: string;
  readonly mime: string;
  readonly storage_key: string;
  readonly status: DocumentStatus;
}

export interface NewExtraction {
  readonly document_id: string;
  readonly organisation_id: string;
  readonly doc_type: string;
  readonly decision: ExtractionVerdict["decision"];
  readonly verdict: ExtractionVerdict;
  readonly source: "pipeline" | "human";
  readonly reviewed_by: string | null;
  readonly used_model: boolean;
  readonly provider: string | null;
  readonly model: string | null;
  readonly prompt_version: string | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cost_usd: number | null;
}

/** The database side, written with the service role. Supabase in production; in-memory in tests. */
export interface ProcessingStore {
  getDocument(id: string): Promise<StoredDocument | null>;
  setStatus(id: string, status: DocumentStatus, error?: string | null): Promise<void>;
  hasPipelineExtraction(documentId: string, promptVersion: string): Promise<boolean>;
  /**
   * The extraction and the document status it implies, in one transaction (public.record_extraction).
   * `actor` is the reviewer for a human review — re-checked as member+ in the database — or null for
   * the pipeline itself.
   */
  recordExtraction(row: NewExtraction, status: DocumentStatus, actor: string | null): Promise<void>;
}

/** The file side. R2 in production. */
export interface FileStorage {
  get(key: string): Promise<Uint8Array | null>;
}

/** Local PDF reading (unpdf in production). No model involved. */
export interface PdfReader {
  read(bytes: Uint8Array): Promise<{ readonly text: string; readonly pages: number }>;
}

export interface ProcessDeps {
  readonly store: ProcessingStore;
  readonly storage: FileStorage;
  readonly gateway: Gateway;
  /** The gateway's usage sink, read back to record what this document cost. */
  readonly lastUsage: () => UsageRecord | null;
  readonly pdf: PdfReader;
  readonly today: () => string;
}

/** Fewer characters than this and the "text layer" is a scan's stray artefacts, not text. */
export const MIN_TEXT_LAYER_CHARS = 40;

export type ProcessOutcome =
  | { readonly kind: "missing" }
  | { readonly kind: "already-processed" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "too-long"; readonly reason: string }
  | { readonly kind: "extracted"; readonly decision: ExtractionVerdict["decision"]; readonly usedModel: boolean };

const EMPTY_PASS: DeterministicPass = { resolved: [], remaining: [], ambiguous: [], coverage: 0 };

export async function processDocument(deps: ProcessDeps, documentId: string): Promise<ProcessOutcome> {
  const doc = await deps.store.getDocument(documentId);
  if (!doc) return { kind: "missing" };

  // Queues deliver at least once. A redelivered message for a document already extracted by this
  // prompt version must not spend a second model call.
  if (await deps.store.hasPipelineExtraction(doc.id, extractDocument.promptVersion)) {
    return { kind: "already-processed" };
  }

  const schema = schemaFor(doc.doc_type);
  if (!schema) {
    const reason = `No extraction schema for document type "${doc.doc_type}".`;
    await deps.store.setStatus(doc.id, "failed", reason);
    return { kind: "failed", reason };
  }

  await deps.store.setStatus(doc.id, "processing");

  const bytes = await deps.storage.get(doc.storage_key);
  if (!bytes) {
    const reason = "The uploaded file is missing from storage.";
    await deps.store.setStatus(doc.id, "failed", reason);
    return { kind: "failed", reason };
  }

  let textLayer = "";
  let pdf: { bytes: Uint8Array; pages: number } | undefined;
  let pages: { bytes: Uint8Array; mime: string }[] = [];
  if (doc.mime === "application/pdf") {
    const read = await deps.pdf.read(bytes);
    if (read.text.trim().length >= MIN_TEXT_LAYER_CHARS) textLayer = read.text;
    else pdf = { bytes, pages: read.pages };
  } else {
    pages = [{ bytes, mime: doc.mime }];
  }

  let outcome;
  try {
    outcome = await deps.gateway.runTask(
      extractDocument,
      { documentType: doc.doc_type, textLayer, pages, ...(pdf ? { pdf } : {}) },
      { organisationId: doc.organisation_id },
    );
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      // Not a failure of the document — too long to read automatically within budget. A person
      // can still enter the fields by hand (reviewDocument), which is what "needs review" offers.
      const reason =
        "Too long to read automatically within the per-document budget — enter the details by hand.";
      await deps.store.setStatus(doc.id, "needs_review", reason);
      return { kind: "too-long", reason };
    }
    throw error; // transient (network, provider) — let the queue retry
  }

  // The deterministic pass is re-run rather than taken from the task: it is pure and cheap, and
  // it is what the gate needs to know which values came from a confirmed pattern.
  const pass = extractDeterministically(schema, textLayer);
  const modelValues: Readonly<Record<string, FieldValue | undefined>> = outcome.resolvedWithoutModel ? {} : outcome.value.values;
  const verdict = gateExtraction({ schema, pass, modelValues, asOf: deps.today() });
  const usage = deps.lastUsage();

  await deps.store.recordExtraction({
    document_id: doc.id,
    organisation_id: doc.organisation_id,
    doc_type: doc.doc_type,
    decision: verdict.decision,
    verdict,
    source: "pipeline",
    reviewed_by: null,
    used_model: !outcome.resolvedWithoutModel,
    provider: usage && !usage.resolvedWithoutModel ? usage.providerId : null,
    model: usage && !usage.resolvedWithoutModel ? usage.model : null,
    prompt_version: extractDocument.promptVersion,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    cost_usd: usage?.costUsd ?? null,
  }, verdict.decision === "accept" ? "accepted" : "needs_review", null);
  return { kind: "extracted", decision: verdict.decision, usedModel: !outcome.resolvedWithoutModel };
}

export type ReviewOutcome =
  | { readonly kind: "accepted" }
  | { readonly kind: "rejected"; readonly reasons: readonly string[]; readonly invalidFields: readonly string[] };

/**
 * A person enters or corrects the fields. The same validators and the same gate apply to typed
 * values as to extracted ones — a human review is not a way around "the date must be a real date"
 * or "every required field present". Only an accepted verdict is stored.
 */
export async function reviewDocument(
  deps: Pick<ProcessDeps, "store" | "today">,
  documentId: string,
  values: Readonly<Record<string, FieldValue>>,
  reviewerId: string,
): Promise<ReviewOutcome | { readonly kind: "missing" }> {
  const doc = await deps.store.getDocument(documentId);
  if (!doc) return { kind: "missing" };
  const schema = schemaFor(doc.doc_type);
  if (!schema) return { kind: "rejected", reasons: [`Unknown document type "${doc.doc_type}".`], invalidFields: [] };

  // Only the schema's own fields; anything else in the request is ignored, not stored.
  const known = new Set(schema.fields.map((f) => f.key));
  const typed = Object.fromEntries(Object.entries(values).filter(([key]) => known.has(key)));
  const verdict = gateExtraction({ schema, pass: EMPTY_PASS, modelValues: typed, asOf: deps.today() });
  if (verdict.decision !== "accept") {
    return { kind: "rejected", reasons: verdict.reasons, invalidFields: verdict.invalidFields };
  }

  await deps.store.recordExtraction({
    document_id: doc.id,
    organisation_id: doc.organisation_id,
    doc_type: doc.doc_type,
    decision: "accept",
    verdict,
    source: "human",
    reviewed_by: reviewerId,
    used_model: false,
    provider: null,
    model: null,
    prompt_version: null,
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
  }, "accepted", reviewerId);
  return { kind: "accepted" };
}
