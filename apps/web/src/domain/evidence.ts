/**
 * Stored documents → the evidence the catalog evaluator reads (D-051). Pure: the rows come from
 * tables no client can write (migration 0003), and this only arranges them — @cfm/evidence decides
 * which requirements an accepted extraction may satisfy, and refuses cross-market matches.
 */

import type { Catalog, EvidenceView } from "@cfm/catalog";
import type { ExtractionVerdict } from "@cfm/documents";
import { evidenceFromVerdict, linkEvidence, type EvidenceRecord, type RefusedLink } from "@cfm/evidence";

export interface DocumentRow {
  readonly id: string;
  readonly organisation_id: string;
  readonly doc_type: string;
  readonly filename: string;
  readonly mime: string;
  readonly byte_size: number;
  readonly status: "queued" | "processing" | "accepted" | "needs_review" | "failed";
  readonly error: string | null;
  readonly created_at: string;
}

export interface ExtractionRow {
  readonly id: string;
  readonly document_id: string;
  readonly decision: "accept" | "review";
  readonly verdict: ExtractionVerdict;
  readonly source: "pipeline" | "human";
  readonly reviewed_by: string | null;
  readonly used_model: boolean;
  readonly created_at: string;
}

export interface LinkRow {
  readonly document_id: string;
  readonly product_id: string;
}

export const DOCUMENT_COLUMNS = "id, organisation_id, doc_type, filename, mime, byte_size, status, error, created_at";
export const EXTRACTION_COLUMNS = "id, document_id, decision, verdict, source, reviewed_by, used_model, created_at";

/** The current extraction for each document: the most recent one. */
export function latestExtractions(rows: readonly ExtractionRow[]): Map<string, ExtractionRow> {
  const latest = new Map<string, ExtractionRow>();
  for (const row of rows) {
    const current = latest.get(row.document_id);
    if (!current || row.created_at > current.created_at) latest.set(row.document_id, row);
  }
  return latest;
}

export interface ProductEvidence {
  readonly view: EvidenceView;
  readonly records: readonly EvidenceRecord[];
  readonly refused: readonly RefusedLink[];
}

/**
 * For each product, the evidence from documents linked to it whose current extraction was
 * accepted. A document awaiting review contributes nothing — evidenceFromVerdict would refuse it
 * anyway; it's filtered here so the refusal isn't an exception.
 */
export function evidenceByProduct(
  productIds: readonly string[],
  documents: readonly DocumentRow[],
  extractions: readonly ExtractionRow[],
  links: readonly LinkRow[],
  catalog: Catalog,
): Map<string, ProductEvidence> {
  const latest = latestExtractions(extractions);
  const byId = new Map(documents.map((d) => [d.id, d]));
  const result = new Map<string, ProductEvidence>();

  for (const productId of productIds) {
    const records: EvidenceRecord[] = [];
    for (const link of links) {
      if (link.product_id !== productId) continue;
      const doc = byId.get(link.document_id);
      const extraction = latest.get(link.document_id);
      if (!doc || !extraction || extraction.decision !== "accept") continue;
      records.push(evidenceFromVerdict(doc.id, doc.doc_type, extraction.verdict));
    }
    const { view, refused } = linkEvidence(records, catalog);
    result.set(productId, { view, records, refused });
  }
  return result;
}
