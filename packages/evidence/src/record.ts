/**
 * The unit this package links against the catalog: one accepted extraction's outcome, held
 * against whichever product it was uploaded for.
 *
 * Deliberately holds only what `gateExtraction` (`@cfm/documents`) already decided was good
 * enough to accept. This package does not re-judge an extraction's quality — that gate is
 * `@cfm/documents`' and it is deterministic; this package decides which catalog requirements an
 * *already-accepted* extraction may satisfy, which is a different question (market scope, not
 * field validity).
 */

import type { ExtractionVerdict, FieldValue } from "@cfm/documents";

export interface EvidenceRecord {
  readonly documentId: string;
  /** Document type, e.g. "epr_certificate", "rp_mandate" — matched against `RequiredEvidence.type`. */
  readonly type: string;
  readonly values: Readonly<Record<string, FieldValue>>;
  /**
   * When this evidence stops counting, taken from the extraction's own `valid_to` field where
   * the schema has one. Null when the document states no expiry — whether an unstated expiry
   * is itself a problem is the catalog requirement's own `required_evidence[].expires` flag to
   * decide (`@cfm/catalog`'s evaluator already does this via `EvidenceRef.valid_to`), not
   * something this record invents.
   */
  readonly validTo: string | null;
}

/**
 * Builds an `EvidenceRecord` from an accepted extraction.
 *
 * Throws on anything other than `decision === "accept"` rather than silently degrading a
 * review-flagged extraction into evidence with gaps: an extraction that needed a human look
 * does not become proof of anything until that look happens and produces its own accepted
 * verdict — that is `gateExtraction`'s entire purpose, and this function does not get to
 * second-guess it in either direction.
 */
export function evidenceFromVerdict(
  documentId: string,
  type: string,
  verdict: ExtractionVerdict,
): EvidenceRecord {
  if (verdict.decision !== "accept") {
    throw new Error(
      `Cannot build evidence from document "${documentId}": its extraction was not accepted ` +
        `(${verdict.reasons.join("; ") || "no reason recorded"}). Resolve the review card first ` +
        `— @cfm/evidence never treats a reviewed-but-not-yet-accepted extraction as evidence.`,
    );
  }

  const values = Object.fromEntries(verdict.fields.map((f) => [f.key, f.value]));
  const validTo = typeof values["valid_to"] === "string" ? values["valid_to"] : null;
  return { documentId, type, values, validTo };
}
