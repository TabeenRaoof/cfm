/**
 * Facts a document states that a requirement also asks for as data (D-051). A requirement is "met"
 * only with its evidence AND its data — an accepted RP mandate proves the appointment, but the
 * requirement still asks for rp.name / rp.address / rp.contact as facts. Rather than copy them
 * silently, the app proposes them and the seller applies them: a visible, audited write.
 *
 * Where the target fact path comes from the catalog, it's derived rather than listed — an EPR
 * certificate's registration number goes to whichever fact the requirement scoped to that
 * certificate's own country asks for, so a German LUCID number can only ever fill Germany's field.
 */

import type { Catalog } from "@cfm/catalog";
import type { ExtractionVerdict } from "@cfm/documents";
import { requirementMarketScope } from "@cfm/evidence";
import { factLabel } from "./facts.ts";

export interface FactProposal {
  readonly scope: "product" | "organisation";
  readonly path: string;
  readonly label: string;
  readonly value: string;
}

/** RP mandate field → the product fact it states. Convention rp_x ↔ rp.x; checked against the catalog in tests. */
const RP_MANDATE_FIELDS: Readonly<Record<string, string>> = {
  rp_name: "rp.name",
  rp_address: "rp.address",
  rp_contact: "rp.contact",
};

function fieldValue(verdict: ExtractionVerdict, key: string): string | null {
  const value = verdict.fields.find((f) => f.key === key)?.value;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function proposeFacts(docType: string, verdict: ExtractionVerdict, catalog: Catalog): FactProposal[] {
  if (verdict.decision !== "accept") return [];

  if (docType === "rp_mandate") {
    return Object.entries(RP_MANDATE_FIELDS).flatMap(([field, path]) => {
      const value = fieldValue(verdict, field);
      return value ? [{ scope: "product" as const, path, label: factLabel(path, catalog), value }] : [];
    });
  }

  if (docType === "epr_certificate") {
    const country = fieldValue(verdict, "country");
    const number = fieldValue(verdict, "registration_number");
    if (!country || !number) return [];
    const proposals: FactProposal[] = [];
    for (const requirement of catalog.requirements) {
      if (!requirement.required_evidence.some((e) => e.type === "epr_certificate")) continue;
      const scope = requirementMarketScope(requirement);
      // Only a requirement scoped to exactly this certificate's country — never an unscoped one,
      // which would let one country's registration answer for another scheme entirely.
      if (scope.kind !== "countries" || scope.isoCountries.size !== 1 || !scope.isoCountries.has(country)) continue;
      for (const datum of requirement.required_data) {
        if (!/^(packaging|organisation)\./.test(datum.key)) continue;
        proposals.push({ scope: "organisation", path: datum.key, label: datum.label, value: number });
      }
    }
    return proposals;
  }

  return [];
}
