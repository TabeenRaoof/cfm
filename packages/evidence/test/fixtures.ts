import type { Condition, Requirement } from "@cfm/catalog";

/**
 * A minimal but fully-shaped Requirement, so each test only has to state what it actually
 * varies. Every field is filled rather than left `as any`, because a fixture that quietly
 * relies on the type checker being lax is the first thing that breaks when the shape changes.
 */
export function requirement(overrides: Partial<Requirement> & { readonly id: string }): Requirement {
  return {
    version: "2026.09",
    state: "draft",
    jurisdiction: "EU",
    regulation: "Test regulation",
    article_ref: "Art. 1",
    title: overrides.id,
    summary: "A fixture requirement.",
    applies_when: { always: true },
    required_data: [],
    required_evidence: [],
    channel_mappings: {},
    effective_from: "2020-01-01",
    effective_to: null,
    sources: [],
    confidence: "high",
    last_reviewed_at: null,
    reviewer: null,
    ...overrides,
  };
}

export const marketIs = (isoCountry: string): Condition => ({ "market.iso_country": isoCountry });
