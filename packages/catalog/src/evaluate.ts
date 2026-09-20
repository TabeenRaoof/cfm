/**
 * The evaluator: one SKU, one market, optionally one channel, against the catalog.
 *
 * Output is one `Assessment` per requirement — the system-of-record cell from the technical
 * plan §4. Every assessment carries its own citation, review date and confidence, so that no
 * consumer can render a requirement without them (decisions.md D-008). They travel together
 * because a UI that has to fetch the citation separately is a UI that will ship without it.
 */

import type { Catalog } from "./catalog.ts";
import { inForce } from "./catalog.ts";
import type { EvaluationSubject } from "./facts.ts";
import { resolveFact } from "./facts.ts";
import { evaluateCondition } from "./dsl.ts";
import type { Truth } from "./truth.ts";
import type {
  AssessmentStatus,
  Confidence,
  Requirement,
  RequiredDatum,
  RequiredEvidence,
} from "./types.ts";
import { isMarketReady } from "./types.ts";

export interface EvidenceRef {
  readonly type: string;
  readonly valid_from?: string | null;
  readonly valid_to?: string | null;
}

export interface EvidenceView {
  /** Evidence already linked to this product for this requirement. */
  evidenceFor(requirementId: string): readonly EvidenceRef[];
  /** Is there an outstanding supplier request covering this requirement? */
  hasOpenRequest(requirementId: string): boolean;
}

/**
 * The evidence view used by the free scanner, which has no account and no uploads. Everything
 * applicable comes back as `missing`, which is the honest answer to "you have given us a
 * spreadsheet and nothing else".
 */
export const NO_EVIDENCE: EvidenceView = {
  evidenceFor: () => [],
  hasOpenRequest: () => false,
};

export interface Citation {
  readonly title: string;
  readonly url: string;
  readonly retrieved_at: string | null;
}

export interface Assessment {
  readonly requirement_id: string;
  readonly title: string;
  readonly jurisdiction: string;
  readonly regulation: string;
  readonly article_ref: string;
  readonly catalog_version: string;
  readonly market: string;
  readonly channel: string | null;
  readonly status: AssessmentStatus;
  readonly applicability: Truth;
  /** Ask the customer for these and the `unknown` resolves. Empty unless status is `unknown`. */
  readonly missing_facts: readonly string[];
  readonly missing_data: readonly RequiredDatum[];
  readonly missing_evidence: readonly RequiredEvidence[];
  readonly expired_evidence: readonly string[];
  readonly citations: readonly Citation[];
  readonly confidence: Confidence;
  readonly last_reviewed_at: string | null;
}

export interface ProductAssessment {
  readonly market: string;
  readonly channel: string | null;
  readonly catalog_version: string;
  readonly assessed_at: string;
  readonly assessments: readonly Assessment[];
  /** True only if every assessment is `met` or `na`. One `unknown` is enough to make it false. */
  readonly market_ready: boolean;
  /** Every fact worth asking for, deduplicated across requirements, most useful first. */
  readonly questions: readonly string[];
}

export interface AssessOptions {
  readonly asOf: string;
  readonly evidence?: EvidenceView;
}

export function assessProduct(
  catalog: Catalog,
  subject: EvaluationSubject,
  options: AssessOptions,
): ProductAssessment {
  const evidence = options.evidence ?? NO_EVIDENCE;

  const assessments = catalog.requirements
    .filter((r) => inForce(r, options.asOf))
    .map((r) => assessRequirement(r, catalog.version, subject, options.asOf, evidence));

  return {
    market: subject.market.iso_country,
    channel: subject.channel?.type ?? null,
    catalog_version: catalog.version,
    assessed_at: options.asOf,
    assessments,
    market_ready: assessments.every((a) => isMarketReady(a.status)),
    questions: rankQuestions(assessments),
  };
}

function assessRequirement(
  requirement: Requirement,
  catalogVersion: string,
  subject: EvaluationSubject,
  asOf: string,
  evidence: EvidenceView,
): Assessment {
  const applicability = evaluateCondition(requirement.applies_when, subject);

  const base = {
    requirement_id: requirement.id,
    title: requirement.title,
    jurisdiction: requirement.jurisdiction,
    regulation: requirement.regulation,
    article_ref: requirement.article_ref,
    catalog_version: catalogVersion,
    market: subject.market.iso_country,
    channel: subject.channel?.type ?? null,
    applicability: applicability.truth,
    citations: requirement.sources.map((s) => ({
      title: s.title,
      url: s.url,
      retrieved_at: s.retrieved_at,
    })),
    confidence: requirement.confidence,
    last_reviewed_at: requirement.last_reviewed_at,
  } as const;

  // THE HARD RULE. An applicability we could not decide is reported as `unknown` with the
  // questions that would decide it — never as `na`, which would remove the row from the matrix
  // and let an unresolved obligation read as a clean bill of health.
  if (applicability.truth === "unknown") {
    return {
      ...base,
      status: "unknown",
      missing_facts: applicability.missing,
      missing_data: [],
      missing_evidence: [],
      expired_evidence: [],
    };
  }

  if (applicability.truth === "false") {
    return {
      ...base,
      status: "na",
      missing_facts: [],
      missing_data: [],
      missing_evidence: [],
      expired_evidence: [],
    };
  }

  const missingData = requirement.required_data.filter(
    (d) => !isSupplied(resolveFact(d.key, subject).value),
  );

  const linked = evidence.evidenceFor(requirement.id);
  const expired: string[] = [];
  const missingEvidence: RequiredEvidence[] = [];

  for (const required of requirement.required_evidence) {
    const matches = linked.filter((e) => e.type === required.type);
    if (matches.length === 0) {
      missingEvidence.push(required);
      continue;
    }
    // A document that is present but out of date is worse than an absent one, because the
    // customer believes it is handled. It gets its own status rather than folding into `met`.
    if (required.expires && matches.every((e) => isExpired(e, asOf))) {
      expired.push(required.type);
    }
  }

  return {
    ...base,
    status: statusFor({
      requirement,
      missingDataCount: missingData.length,
      missingEvidenceCount: missingEvidence.length,
      expiredCount: expired.length,
      hasOpenRequest: evidence.hasOpenRequest(requirement.id),
    }),
    missing_facts: [],
    missing_data: missingData,
    missing_evidence: missingEvidence,
    expired_evidence: expired,
  };
}

function statusFor(input: {
  requirement: Requirement;
  missingDataCount: number;
  missingEvidenceCount: number;
  expiredCount: number;
  hasOpenRequest: boolean;
}): AssessmentStatus {
  const required = input.requirement.required_data.length + input.requirement.required_evidence.length;
  const outstanding = input.missingDataCount + input.missingEvidenceCount;

  if (input.expiredCount > 0) return "expired";
  if (outstanding === 0) return "met";
  if (input.hasOpenRequest) return "pending";
  if (outstanding < required) return "partial";
  return "missing";
}

/** `undefined` is unknown and `null` is a known absence; neither satisfies a required field. */
function isSupplied(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isExpired(ref: EvidenceRef, asOf: string): boolean {
  return typeof ref.valid_to === "string" && ref.valid_to < asOf;
}

/**
 * Order the open questions by how many requirements each would resolve. Asking a customer for
 * one fact that unblocks nine rows is a different experience from asking for nine facts.
 */
function rankQuestions(assessments: readonly Assessment[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const a of assessments) {
    for (const fact of a.missing_facts) counts.set(fact, (counts.get(fact) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([fact]) => fact);
}
