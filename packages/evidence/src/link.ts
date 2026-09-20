/**
 * Turns a product's held evidence and open supplier requests into the real `EvidenceView` the
 * evaluator asks for (`packages/catalog/src/evaluate.ts`) — the missing middle between an
 * accepted extraction and a green cell. `02-` §10.1 week 6; D-012 Slice B's own definition of
 * done is "a design partner's SKU goes from red to green by uploading the right docs", and
 * nothing before this package could make that happen — `EvidenceView` and `NO_EVIDENCE` existed
 * in `@cfm/catalog`, but nothing implemented the real one.
 *
 * The one rule this package exists to enforce: evidence is scoped to a market, and a document
 * for one market never counts toward a requirement for a different one, even when both share
 * the same document `type`. Nine catalog requirements require `epr_certificate` across DE, FR,
 * IT, ES, NL, BE, AT and UK — matching on `type` alone would let a German LUCID certificate turn
 * the French Citeo cell green, which is a false green: the exact failure mode the hard rule
 * exists to prevent, in a different costume. Where a document does not state which market it is
 * for, but the requirement needs to know, this refuses to link rather than guess — the same
 * discipline `@cfm/import` keeps for "we were not told" versus "no".
 *
 * No model call anywhere in this package. The extraction already happened and was already
 * gated by `gateExtraction`; this is pure, deterministic matching against the catalog.
 */

import type { Catalog, EvidenceRef, EvidenceView } from "@cfm/catalog";
import { isTerminal } from "@cfm/supplier-request";
import type { SupplierRequest } from "@cfm/supplier-request";

import type { EvidenceRecord } from "./record.ts";
import { requirementMarketScope } from "./scope.ts";
import type { MarketScope } from "./scope.ts";

/** The field key every country-scoped document schema uses for the market it covers. */
const COUNTRY_FIELD_KEY = "country";

/**
 * A refusal to link a document to a requirement it would otherwise match on type — surfaced
 * rather than silently dropped, since a refusal here is exactly the kind of gap a human should
 * be able to see and act on (upload the right document, or confirm the market by hand).
 */
export interface RefusedLink {
  readonly documentId: string;
  readonly requirementId: string;
  readonly reason: string;
}

export interface LinkResult {
  readonly view: EvidenceView;
  readonly refused: readonly RefusedLink[];
}

export function linkEvidence(
  records: readonly EvidenceRecord[],
  catalog: Catalog,
  openSupplierRequests: readonly SupplierRequest[] = [],
): LinkResult {
  const refused: RefusedLink[] = [];
  const byRequirement = new Map<string, EvidenceRef[]>();

  for (const requirement of catalog.requirements) {
    const wantedTypes = new Set(requirement.required_evidence.map((e) => e.type));
    if (wantedTypes.size === 0) continue;

    const scope = requirementMarketScope(requirement);
    const matched: EvidenceRef[] = [];

    for (const record of records) {
      if (!wantedTypes.has(record.type)) continue;

      const outcome = marketMatch(record, scope);
      if (outcome.matches) {
        matched.push({ type: record.type, valid_to: record.validTo });
      } else {
        refused.push({ documentId: record.documentId, requirementId: requirement.id, reason: outcome.reason });
      }
    }

    if (matched.length > 0) byRequirement.set(requirement.id, matched);
  }

  const view: EvidenceView = {
    evidenceFor: (requirementId) => byRequirement.get(requirementId) ?? [],
    hasOpenRequest: (requirementId) => hasOpenRequestFor(openSupplierRequests, requirementId),
  };

  return { view, refused };
}

type MarketMatchOutcome = { readonly matches: true } | { readonly matches: false; readonly reason: string };

function marketMatch(record: EvidenceRecord, scope: MarketScope): MarketMatchOutcome {
  if (scope.kind === "unscoped") return { matches: true };

  const country = record.values[COUNTRY_FIELD_KEY];
  const wanted = [...scope.isoCountries].join("/");

  if (country === undefined || country === null) {
    return {
      matches: false,
      reason:
        `Document "${record.documentId}" (${record.type}) does not state which country it is ` +
        `for, and this requirement is scoped to ${wanted}. Refusing to assume rather than guess ` +
        `— never link a document whose market cannot be confirmed.`,
    };
  }

  if (typeof country !== "string" || !scope.isoCountries.has(country)) {
    return {
      matches: false,
      reason:
        `Document "${record.documentId}" (${record.type}) is for "${String(country)}", not ` +
        `${wanted} — a different market's evidence does not satisfy this requirement, even ` +
        `though the document type matches.`,
    };
  }

  return { matches: true };
}

/**
 * True when at least one non-terminal supplier request still has this requirement outstanding
 * — an item is "still outstanding" when it has never been fulfilled, regardless of whether the
 * request as a whole has other items already fulfilled (that is exactly what
 * `partially_fulfilled` means). A terminal request (fulfilled, expired, cancelled) is not open
 * by definition, whatever its items say.
 */
function hasOpenRequestFor(requests: readonly SupplierRequest[], requirementId: string): boolean {
  return requests.some(
    (request) =>
      !isTerminal(request.status) &&
      request.requestedItems.some(
        (item) => item.requirementId === requirementId && item.fulfilledAt === null,
      ),
  );
}
