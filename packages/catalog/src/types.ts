/**
 * The requirement record. One JSON file per requirement, versioned in git.
 *
 * This shape follows the technical plan §5.1. Two fields are additions, both of them gates
 * rather than data (decisions.md D-008):
 *
 *   `state`   — a requirement is `draft` until a named human has checked it against the primary
 *               source. Drafts never reach the live catalog. An assistant can write a draft; it
 *               cannot promote one.
 *   `sources[].retrieved_at` / `verified` — a citation without a date is not a citation, because
 *               the registry page it points at changes without notice.
 */

import type { Condition } from "./dsl.ts";

export type Jurisdiction = "EU" | "UK" | "US";

export type Confidence = "high" | "medium" | "low";

export type RequirementState = "draft" | "published";

export interface Source {
  readonly title: string;
  readonly url: string;
  /** ISO date the URL was actually opened and read. Required before publishing. */
  readonly retrieved_at: string | null;
  /** True only once a human has read the source and confirmed it says what we claim. */
  readonly verified: boolean;
  readonly note?: string;
}

export interface RequiredDatum {
  /** A fact path, resolved through the same resolver as `applies_when`. */
  readonly key: string;
  readonly label: string;
}

export interface RequiredEvidence {
  /** Document type, e.g. "rp_mandate", "epr_certificate", "test_report". */
  readonly type: string;
  readonly label: string;
  readonly expires: boolean;
}

export interface Requirement {
  readonly id: string;
  readonly version: string;
  readonly state: RequirementState;
  readonly jurisdiction: Jurisdiction;
  readonly regulation: string;
  readonly article_ref: string;
  readonly title: string;
  readonly summary: string;
  readonly applies_when: Condition;
  readonly required_data: readonly RequiredDatum[];
  readonly required_evidence: readonly RequiredEvidence[];
  readonly channel_mappings: Readonly<Record<string, unknown>>;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly sources: readonly Source[];
  readonly confidence: Confidence;
  readonly last_reviewed_at: string | null;
  readonly reviewer: string | null;
}

/**
 * Assessment status, per technical plan §15.3.
 *
 * `unknown` is not a placeholder for "we haven't got round to it" — it is the load-bearing
 * value that says the catalog cannot decide whether this obligation applies to this SKU,
 * because the data needed to decide was never supplied. It is never counted as ready.
 */
export type AssessmentStatus =
  | "unknown"
  | "missing"
  | "pending"
  | "partial"
  | "met"
  | "expired"
  | "na";

/**
 * The only two statuses that count toward "this SKU can be sold in this market".
 *
 * Written as a constant and exported so that no caller can re-derive this list slightly
 * differently and quietly let `unknown` through. Every consumer must use `isMarketReady`.
 */
const MARKET_READY: ReadonlySet<AssessmentStatus> = new Set<AssessmentStatus>(["met", "na"]);

export function isMarketReady(status: AssessmentStatus): boolean {
  return MARKET_READY.has(status);
}
