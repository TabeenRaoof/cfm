/**
 * Documents → evidence → readiness (src/domain/evidence.ts, src/domain/document-facts.ts, D-051).
 * The slice's definition of done (D-012): a SKU goes from red to green by uploading the right
 * documents. This proves it with the real catalog and the scanner's own assessment.
 */

import type { ExtractionVerdict } from "@cfm/documents";
import { assessProduct } from "@cfm/catalog";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/domain/catalog.ts";
import { proposeFacts } from "../src/domain/document-facts.ts";
import { evidenceByProduct, latestExtractions, type DocumentRow, type ExtractionRow } from "../src/domain/evidence.ts";
import { subjectFacts, type ProductRow } from "../src/domain/facts.ts";

const verdict = (decision: "accept" | "review", fields: Record<string, string | null>): ExtractionVerdict => ({
  decision,
  reasons: decision === "accept" ? [] : ["needs a look"],
  fields: Object.entries(fields).map(([key, value]) => ({
    key, label: key, value, source: "model", required: true, validation: { valid: true }, needsConfirmation: false,
  })) as unknown as ExtractionVerdict["fields"],
  missingRequired: [],
  invalidFields: [],
});

const doc = (id: string, doc_type: string): DocumentRow => ({
  id, organisation_id: "org", doc_type, filename: `${id}.pdf`, mime: "application/pdf", byte_size: 1,
  status: "accepted", error: null, created_at: "2026-09-26T10:00:00Z",
});
const extraction = (document_id: string, v: ExtractionVerdict, created_at = "2026-09-26T10:00:00Z"): ExtractionRow => ({
  id: `x-${document_id}-${created_at}`, document_id, decision: v.decision, verdict: v, source: "pipeline",
  reviewed_by: null, used_model: true, created_at,
});

const MANDATE = verdict("accept", {
  rp_name: "Compliance Bridge BV", rp_address: "Keizersgracht 1, Amsterdam", rp_country: "NL",
  rp_contact: "rp@bridge.example", manufacturer_name: "Nordholt", issue_date: "2026-02-03", valid_to: null,
});
const LUCID = verdict("accept", {
  scheme_name: "LUCID", country: "DE", registration_number: "DE1234567890123", registered_name: "Nordholt", valid_to: "2027-12-31",
});

const product: ProductRow = {
  sku: "K-1", title: "Kettle", brand: null, category_code: null, gtin: "4006381333931",
  has_battery: false, is_electrical: true, is_toy: false, has_packaging: true, manufacturer_country: "CN", facts: {},
};
const org = { establishment_country: "GB", facts: {} };

/** The exact status of one requirement — from the evaluator itself, not "not blocking any more". */
function statusIn(market: string, requirementId: string, facts: ProductRow["facts"], orgFacts: object, evidence?: ReturnType<typeof evidenceByProduct>) {
  const result = assessProduct(
    catalog,
    { facts: subjectFacts({ ...org, facts: orgFacts as never }, { ...product, facts }), market: { iso_country: market } },
    { asOf: "2026-09-26", ...(evidence ? { evidence: evidence.get("p1")!.view } : {}) },
  );
  return result.assessments.find((a) => a.requirement_id === requirementId)?.status;
}

describe("from red to green by uploading the right document", () => {
  it("the EU responsible-person requirement: outstanding → met, once the mandate is accepted and its details applied", () => {
    const REQ = "eu.gpsr.responsible-economic-operator";
    expect(statusIn("DE", REQ, {}, {})).toBe("missing");

    const evidence = evidenceByProduct(["p1"], [doc("d1", "rp_mandate")], [extraction("d1", MANDATE)], [{ document_id: "d1", product_id: "p1" }], catalog);
    const applied = Object.fromEntries(proposeFacts("rp_mandate", MANDATE, catalog).map((p) => [p.path, p.value]));
    expect(statusIn("DE", REQ, applied, {})).not.toBe("met"); // the details alone aren't enough
    expect(statusIn("DE", REQ, {}, {}, evidence)).not.toBe("met"); // nor the document alone
    expect(statusIn("DE", REQ, applied, {}, evidence)).toBe("met");
  });

  it("a mandate still awaiting review proves nothing", () => {
    const pending = verdict("review", { rp_name: "Compliance Bridge BV" });
    const evidence = evidenceByProduct(["p1"], [doc("d1", "rp_mandate")], [extraction("d1", pending)], [{ document_id: "d1", product_id: "p1" }], catalog);
    expect(evidence.get("p1")?.records).toEqual([]);
  });

  it("a document linked to a different product doesn't count for this one", () => {
    const evidence = evidenceByProduct(["p1", "p2"], [doc("d1", "rp_mandate")], [extraction("d1", MANDATE)], [{ document_id: "d1", product_id: "p2" }], catalog);
    expect(evidence.get("p1")?.records).toEqual([]);
    expect(evidence.get("p2")?.records).toHaveLength(1);
  });

  it("the current extraction is the latest — a later human correction replaces the pipeline's", () => {
    const later = extraction("d1", verdict("review", {}), "2026-09-27T10:00:00Z");
    const latest = latestExtractions([extraction("d1", MANDATE), later]);
    expect(latest.get("d1")?.decision).toBe("review");
  });
});

describe("a German certificate counts for Germany only", () => {
  const evidence = () =>
    evidenceByProduct(["p1"], [doc("d2", "epr_certificate")], [extraction("d2", LUCID)], [{ document_id: "d2", product_id: "p1" }], catalog);

  it("links to the DE packaging requirement, and is refused for FR's", () => {
    const { view, refused } = evidence().get("p1")!;
    expect(view.evidenceFor("de.epr.packaging-lucid")).toHaveLength(1);
    expect(view.evidenceFor("fr.epr.packaging-citeo")).toEqual([]);
    expect(refused.some((r) => r.requirementId === "fr.epr.packaging-citeo")).toBe(true);
  });

  it("proposes the LUCID number for Germany's field only — never France's, never the EU-wide PPWR one", () => {
    const proposals = proposeFacts("epr_certificate", LUCID, catalog);
    expect(proposals).toEqual([
      { scope: "organisation", path: "packaging.lucid_number", label: expect.any(String), value: "DE1234567890123" },
    ]);
  });
});

describe("proposed facts", () => {
  it("an RP mandate proposes exactly the product facts the RP requirement asks for", () => {
    const paths = proposeFacts("rp_mandate", MANDATE, catalog).map((p) => p.path).sort();
    const wanted = catalog.requirements.find((r) => r.id === "eu.gpsr.responsible-economic-operator")!.required_data.map((d) => d.key).sort();
    expect(paths).toEqual(wanted);
  });

  it("nothing is proposed from an extraction that wasn't accepted", () => {
    expect(proposeFacts("rp_mandate", verdict("review", { rp_name: "X" }), catalog)).toEqual([]);
  });
});
