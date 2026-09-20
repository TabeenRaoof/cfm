import { describe, expect, it } from "vitest";
import { assessProduct } from "@cfm/catalog";
import type { Catalog, EvaluationSubject } from "@cfm/catalog";
import type { SupplierRequest } from "@cfm/supplier-request";
import { linkEvidence } from "../src/link.ts";
import type { EvidenceRecord } from "../src/record.ts";
import { marketIs, requirement } from "./fixtures.ts";

const DE_LUCID = requirement({
  id: "de.epr.packaging-lucid",
  applies_when: { all: [marketIs("DE"), { "product.has_packaging": true }] },
  required_evidence: [{ type: "epr_certificate", label: "Dual-system confirmation", expires: true }],
});

const FR_CITEO = requirement({
  id: "fr.epr.packaging-citeo",
  applies_when: { all: [marketIs("FR"), { "product.has_packaging": true }] },
  required_evidence: [{ type: "epr_certificate", label: "Eco-organisme contribution", expires: true }],
});

const EU_RP_MANDATE = requirement({
  id: "eu.gpsr.responsible-economic-operator",
  applies_when: { all: [{ "market.jurisdiction": "EU" }, { "manufacturer.country_in_eu": false }] },
  required_evidence: [{ type: "rp_mandate", label: "Signed mandate", expires: true }],
});

const CATALOG: Catalog = { version: "test", requirements: [DE_LUCID, FR_CITEO, EU_RP_MANDATE] };

function eprRecord(documentId: string, country: string | null, validTo: string | null = null): EvidenceRecord {
  return { documentId, type: "epr_certificate", values: { country }, validTo };
}

describe("linkEvidence — market scoping", () => {
  it("links a document to the requirement for its own market", () => {
    const { view, refused } = linkEvidence([eprRecord("doc_de", "DE")], CATALOG);
    expect(view.evidenceFor("de.epr.packaging-lucid")).toHaveLength(1);
    expect(view.evidenceFor("fr.epr.packaging-citeo")).toHaveLength(0);
    // The same document is also checked against every other requirement that wants
    // "epr_certificate" — it is correctly refused against the one for a different market
    // (fr.epr.packaging-citeo, asserted in the next test), which is not a bug in this test.
    expect(refused).toHaveLength(1);
  });

  it("refuses to let a German LUCID certificate satisfy the French Citeo requirement — the false-green case", () => {
    // The exact scenario the plan called out: same required_evidence type
    // ("epr_certificate"), different market. Matching on type alone would turn this cell green
    // incorrectly.
    const { view, refused } = linkEvidence([eprRecord("doc_de", "DE")], CATALOG);

    expect(view.evidenceFor("fr.epr.packaging-citeo")).toHaveLength(0);
    expect(refused).toContainEqual(
      expect.objectContaining({ documentId: "doc_de", requirementId: "fr.epr.packaging-citeo" }),
    );
    expect(refused.find((r) => r.requirementId === "fr.epr.packaging-citeo")?.reason).toMatch(
      /different market/,
    );
  });

  it("refuses to link a certificate that does not state its country at all, rather than assuming", () => {
    const { view, refused } = linkEvidence([eprRecord("doc_undated", null)], CATALOG);

    expect(view.evidenceFor("de.epr.packaging-lucid")).toHaveLength(0);
    expect(view.evidenceFor("fr.epr.packaging-citeo")).toHaveLength(0);
    expect(refused).toHaveLength(2); // refused against both country-scoped requirements it could have matched on type
    for (const r of refused) {
      expect(r.reason).toMatch(/does not state which country/);
    }
  });

  it("links an EU-wide document type (rp_mandate) regardless of any country it happens to state", () => {
    // eu.gpsr.responsible-economic-operator is unscoped (no market.iso_country leaf) — the
    // mandate's own rp_country field describes where the RP is established, not which market
    // the requirement is limited to, so no country check applies here at all.
    const record: EvidenceRecord = {
      documentId: "doc_rp",
      type: "rp_mandate",
      values: { rp_country: "IE" },
      validTo: null,
    };
    const { view, refused } = linkEvidence([record], CATALOG);
    expect(view.evidenceFor("eu.gpsr.responsible-economic-operator")).toHaveLength(1);
    expect(refused).toHaveLength(0);
  });

  it("links two documents for two different markets to their own requirements independently", () => {
    const { view, refused } = linkEvidence(
      [eprRecord("doc_de", "DE"), eprRecord("doc_fr", "FR")],
      CATALOG,
    );
    expect(view.evidenceFor("de.epr.packaging-lucid")).toHaveLength(1);
    expect(view.evidenceFor("fr.epr.packaging-citeo")).toHaveLength(1);
    expect(view.evidenceFor("de.epr.packaging-lucid")[0]?.type).toBe("epr_certificate");
    // Each document is correctly refused against the other's requirement — cross-refusal in
    // both directions, which is the false-green guard working symmetrically.
    expect(refused).toHaveLength(2);
    expect(refused).toContainEqual(
      expect.objectContaining({ documentId: "doc_de", requirementId: "fr.epr.packaging-citeo" }),
    );
    expect(refused).toContainEqual(
      expect.objectContaining({ documentId: "doc_fr", requirementId: "de.epr.packaging-lucid" }),
    );
  });

  it("carries the validity window through to the EvidenceRef the evaluator reads", () => {
    const { view } = linkEvidence([eprRecord("doc_de", "DE", "2027-01-01")], CATALOG);
    expect(view.evidenceFor("de.epr.packaging-lucid")[0]?.valid_to).toBe("2027-01-01");
  });

  it("ignores a document whose type no requirement in the catalog asks for", () => {
    const irrelevant: EvidenceRecord = {
      documentId: "doc_x",
      type: "risk_assessment",
      values: {},
      validTo: null,
    };
    const { view, refused } = linkEvidence([irrelevant], CATALOG);
    expect(view.evidenceFor("de.epr.packaging-lucid")).toHaveLength(0);
    expect(refused).toHaveLength(0); // not a refusal — nothing wanted this type at all
  });
});

describe("linkEvidence — hasOpenRequest", () => {
  function supplierRequest(overrides: Partial<SupplierRequest> = {}): SupplierRequest {
    return {
      id: "req_1",
      productIds: ["prod_1"],
      partyId: "party_1",
      requestedItems: [
        { key: "epr", requirementId: "fr.epr.packaging-citeo", label: "EPR cert", fulfilledAt: null },
      ],
      tokenHash: "a".repeat(64),
      createdAt: "2026-09-01T00:00:00Z",
      sentAt: "2026-09-01T00:00:00Z",
      openedAt: null,
      dueAt: "2026-09-15T00:00:00Z",
      status: "sent",
      remindersSent: [],
      cancelledAt: null,
      ...overrides,
    };
  }

  it("is true when a non-terminal request has this requirement outstanding", () => {
    const { view } = linkEvidence([], CATALOG, [supplierRequest()]);
    expect(view.hasOpenRequest("fr.epr.packaging-citeo")).toBe(true);
    expect(view.hasOpenRequest("de.epr.packaging-lucid")).toBe(false);
  });

  it("is false once the request is terminal, even if the item was never fulfilled", () => {
    const cancelled = supplierRequest({ status: "cancelled", cancelledAt: "2026-09-05T00:00:00Z" });
    const { view } = linkEvidence([], CATALOG, [cancelled]);
    expect(view.hasOpenRequest("fr.epr.packaging-citeo")).toBe(false);
  });

  it("is false once the specific item has been fulfilled, even if the request is still open", () => {
    const fulfilledItem = supplierRequest({
      status: "partially_fulfilled",
      requestedItems: [
        {
          key: "epr",
          requirementId: "fr.epr.packaging-citeo",
          label: "EPR cert",
          fulfilledAt: "2026-09-04T00:00:00Z",
        },
      ],
    });
    const { view } = linkEvidence([], CATALOG, [fulfilledItem]);
    expect(view.hasOpenRequest("fr.epr.packaging-citeo")).toBe(false);
  });
});

describe("linkEvidence — end to end through the real evaluator", () => {
  const FR_PRODUCT: EvaluationSubject = {
    facts: { "product.has_packaging": true },
    market: { iso_country: "FR" },
  };

  it("takes a SKU from missing to met by uploading the right document — D-012 Slice B's own definition of done", () => {
    const before = assessProduct(CATALOG, FR_PRODUCT, { asOf: "2026-09-19" });
    const beforeStatus = before.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo");
    expect(beforeStatus?.status).toBe("missing");

    const { view } = linkEvidence([eprRecord("doc_fr", "FR", "2027-12-31")], CATALOG);
    const after = assessProduct(CATALOG, FR_PRODUCT, { asOf: "2026-09-19", evidence: view });
    const afterStatus = after.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo");
    expect(afterStatus?.status).toBe("met");
  });

  it("does not go green from a German certificate uploaded for the wrong market", () => {
    const { view } = linkEvidence([eprRecord("doc_de", "DE", "2027-12-31")], CATALOG);
    const after = assessProduct(CATALOG, FR_PRODUCT, { asOf: "2026-09-19", evidence: view });
    const status = after.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo");
    expect(status?.status).toBe("missing");
  });

  it("moves to pending once a supplier request is open, then to met once it is uploaded and fulfilled", () => {
    const request: SupplierRequest = {
      id: "req_1",
      productIds: ["prod_1"],
      partyId: "party_1",
      requestedItems: [
        { key: "epr", requirementId: "fr.epr.packaging-citeo", label: "EPR cert", fulfilledAt: null },
      ],
      tokenHash: "a".repeat(64),
      createdAt: "2026-09-01T00:00:00Z",
      sentAt: "2026-09-01T00:00:00Z",
      openedAt: null,
      dueAt: "2026-09-30T00:00:00Z",
      status: "sent",
      remindersSent: [],
      cancelledAt: null,
    };

    const { view: pendingView } = linkEvidence([], CATALOG, [request]);
    const pending = assessProduct(CATALOG, FR_PRODUCT, { asOf: "2026-09-19", evidence: pendingView });
    expect(pending.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo")?.status).toBe(
      "pending",
    );

    const { view: metView } = linkEvidence([eprRecord("doc_fr", "FR", "2027-12-31")], CATALOG, [request]);
    const met = assessProduct(CATALOG, FR_PRODUCT, { asOf: "2026-09-19", evidence: metView });
    expect(met.assessments.find((a) => a.requirement_id === "fr.epr.packaging-citeo")?.status).toBe("met");
  });
});
