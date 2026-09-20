import { describe, expect, it } from "vitest";
import type { EvidenceView } from "../src/evaluate.ts";
import { assessProduct, NO_EVIDENCE } from "../src/evaluate.ts";
import { AS_OF, FULLY_KNOWN, loadRealCatalog, without } from "./fixtures.ts";

const { catalog } = await loadRealCatalog(true);

const assess = (
  facts: typeof FULLY_KNOWN,
  opts: { iso?: string; channel?: string | null; evidence?: EvidenceView } = {},
) =>
  assessProduct(
    catalog,
    {
      facts,
      market: { iso_country: opts.iso ?? "DE" },
      ...(opts.channel === null ? {} : { channel: { type: opts.channel ?? "amazon_de" } }),
    },
    { asOf: AS_OF, ...(opts.evidence ? { evidence: opts.evidence } : {}) },
  );

const find = (r: ReturnType<typeof assess>, id: string) =>
  r.assessments.find((a) => a.requirement_id === id);

describe("market scoping", () => {
  it("applies a German scheme in Germany and not in France", () => {
    expect(find(assess(FULLY_KNOWN, { iso: "DE" }), "de.epr.packaging-lucid")?.status).not.toBe("na");
    expect(find(assess(FULLY_KNOWN, { iso: "FR" }), "de.epr.packaging-lucid")?.status).toBe("na");
  });

  it("switches to the UK requirement in the UK and drops the EU ones", () => {
    // The fixture seller is GB-established, which is precisely who does NOT need a UK
    // responsible person — so this assertion needs a seller established elsewhere.
    const nonUk = { ...FULLY_KNOWN, "organisation.establishment_country": "CN" };
    const uk = assess(nonUk, { iso: "GB" });
    expect(find(uk, "uk.gpsr.uk-responsible-person")?.status).not.toBe("na");
    expect(find(uk, "eu.gpsr.responsible-economic-operator")?.status).toBe("na");
  });

  it("does not require a UK responsible person of a UK-established seller", () => {
    const uk = assess(FULLY_KNOWN, { iso: "GB" });
    expect(find(uk, "uk.gpsr.uk-responsible-person")?.status).toBe("na");
  });

  it("does not apply the packaging representative where the seller is established", () => {
    const established = { ...FULLY_KNOWN, "organisation.establishment_country": "DE" };
    expect(find(assess(established, { iso: "DE" }), "eu.ppwr.authorised-representative")?.status).toBe("na");
  });

  it("does not apply the PPWR representative duty to a seller who only sells via a local distributor", () => {
    // PPWR Art. 3(1)(15)(c)/(d): the mandatory Art. 45(3) duty only ever attaches to a producer
    // that sells directly to end users in the market where it isn't established. A manufacturer
    // that sells wholesale to an already-established local distributor, who resells to
    // consumers themselves, is not the Art. 3(1)(15) "producer" for that market at all -- the
    // distributor is -- so it never needed an authorised representative in the first place.
    const viaDistributor = { ...FULLY_KNOWN, "organisation.sells_direct_to_end_users": false };
    expect(find(assess(viaDistributor), "eu.ppwr.authorised-representative")?.status).toBe("na");
  });

  it("does not know the PPWR representative duty applies until told how the seller sells", () => {
    // The hard rule in miniature for this specific fact: absence must read as "unknown", never
    // as either "applies" or "na" — see hard-rule.test.ts for the same assertion made
    // exhaustively across the whole catalog.
    const noChannelInfo = without(FULLY_KNOWN, "organisation.sells_direct_to_end_users");
    const result = find(assess(noChannelInfo), "eu.ppwr.authorised-representative");
    expect(result?.status).toBe("unknown");
    expect(result?.missing_facts).toContain("organisation.sells_direct_to_end_users");
  });
});

describe("national packaging-EPR scoping (batch 4, PR #6 review)", () => {
  it("does not apply the Austrian representative duty to a B2B-only seller", () => {
    // AWG 2002 § 12b(1) + § 13g(1)(5): mandatory AR appointment only attaches to a distance
    // seller with no AT establishment selling to a PRIVATE end consumer. A seller who only
    // sells to businesses has an optional right under § 16a, not a duty -- same shape as the
    // PPWR fix above (D-040), reusing the same fact.
    const b2bOnly = { ...FULLY_KNOWN, "organisation.sells_direct_to_end_users": false };
    expect(find(assess(b2bOnly, { iso: "AT" }), "at.epr.authorised-representative")?.status).toBe(
      "na",
    );
  });

  it("does not know the Austrian representative duty applies until told how the seller sells", () => {
    const noChannelInfo = without(FULLY_KNOWN, "organisation.sells_direct_to_end_users");
    const result = find(assess(noChannelInfo, { iso: "AT" }), "at.epr.authorised-representative");
    expect(result?.status).toBe("unknown");
  });

  it("does not apply the Belgian IVC duty below the 300kg treaty threshold", () => {
    // Cooperation Agreement of 4 Nov. 2008, Art. 6: the take-back obligation (and Art. 18's
    // reporting duty, which is worded as applying to the same population) only attaches at
    // 300 kg/year or more.
    const underThreshold = { ...FULLY_KNOWN, "organisation.be_packaging_kg_previous_year": 299 };
    expect(find(assess(underThreshold, { iso: "BE" }), "be.epr.packaging-ivc")?.status).toBe("na");
  });

  it("does not know the Belgian IVC duty applies until told the seller's packaging volume", () => {
    const noVolume = without(FULLY_KNOWN, "organisation.be_packaging_kg_previous_year");
    const result = find(assess(noVolume, { iso: "BE" }), "be.epr.packaging-ivc");
    expect(result?.status).toBe("unknown");
  });

  it("does not apply the Italian CONAI duty to a seller with no IT establishment or fiscal rep", () => {
    // CONAI's own membership rules: a foreign company with neither an Italian establishment
    // nor an Italian fiscal representative cannot join CONAI as a standard member, so the row
    // must not tell it that it has to.
    const neitherRoute = {
      ...FULLY_KNOWN,
      "organisation.has_it_fiscal_representative": false,
    };
    // FULLY_KNOWN's seller is GB-established, so organisation.established_in_market is already
    // false for the IT market -- only the fiscal-rep fact needs overriding here.
    expect(find(assess(neitherRoute, { iso: "IT" }), "it.epr.packaging-conai")?.status).toBe("na");
  });

  it("still applies the Italian CONAI duty to a seller with only a fiscal representative", () => {
    expect(
      find(assess(FULLY_KNOWN, { iso: "IT" }), "it.epr.packaging-conai")?.status,
    ).not.toBe("na");
  });

  it("does not know the Italian CONAI duty applies until told about a fiscal representative", () => {
    const noFiscalRepInfo = without(FULLY_KNOWN, "organisation.has_it_fiscal_representative");
    const result = find(assess(noFiscalRepInfo, { iso: "IT" }), "it.epr.packaging-conai");
    expect(result?.status).toBe("unknown");
  });
});

describe("channel scoping", () => {
  it("applies marketplace traceability on a marketplace", () => {
    expect(find(assess(FULLY_KNOWN, { channel: "amazon_de" }), "eu.dsa.trader-information")?.status).not.toBe("na");
  });

  it("does not apply it to an own storefront", () => {
    expect(find(assess(FULLY_KNOWN, { channel: "shopify" }), "eu.dsa.trader-information")?.status).toBe("na");
  });

  it("says it does not know when no channel was given", () => {
    const noChannel = find(assess(FULLY_KNOWN, { channel: null }), "eu.dsa.trader-information");
    expect(noChannel?.status).toBe("unknown");
    expect(noChannel?.missing_facts).toEqual(["channel.type"]);
  });
});

describe("status semantics", () => {
  it("reports missing when the requirement applies and nothing has been supplied", () => {
    const facts = { "manufacturer.country": "CN" };
    const rp = find(assess(facts), "eu.gpsr.responsible-economic-operator");
    expect(rp?.status).toBe("missing");
    expect(rp?.missing_data.map((d) => d.key)).toEqual(["rp.name", "rp.address", "rp.contact"]);
    expect(rp?.missing_evidence.map((e) => e.type)).toEqual(["rp_mandate"]);
  });

  it("reports partial when some of it has been supplied", () => {
    const facts = { "manufacturer.country": "CN", "rp.name": "Example EU Rep GmbH" };
    expect(find(assess(facts), "eu.gpsr.responsible-economic-operator")?.status).toBe("partial");
  });

  it("treats an explicitly empty value as not supplied", () => {
    const facts = { "manufacturer.country": "CN", "rp.name": null };
    const rp = find(assess(facts), "eu.gpsr.responsible-economic-operator");
    expect(rp?.missing_data.map((d) => d.key)).toContain("rp.name");
  });

  it("reports met once the data and the evidence are both there", () => {
    const evidence: EvidenceView = {
      evidenceFor: (id) =>
        id === "eu.gpsr.responsible-economic-operator"
          ? [{ type: "rp_mandate", valid_to: "2027-12-31" }]
          : [],
      hasOpenRequest: () => false,
    };
    expect(find(assess(FULLY_KNOWN, { evidence }), "eu.gpsr.responsible-economic-operator")?.status).toBe("met");
  });

  it("reports expired rather than met when the document has lapsed", () => {
    // A stale document is worse than a missing one: the customer believes it is handled.
    const evidence: EvidenceView = {
      evidenceFor: (id) =>
        id === "eu.gpsr.responsible-economic-operator"
          ? [{ type: "rp_mandate", valid_to: "2026-01-01" }]
          : [],
      hasOpenRequest: () => false,
    };
    const rp = find(assess(FULLY_KNOWN, { evidence }), "eu.gpsr.responsible-economic-operator");
    expect(rp?.status).toBe("expired");
    expect(rp?.expired_evidence).toEqual(["rp_mandate"]);
  });

  it("reports pending while a supplier request is open", () => {
    const evidence: EvidenceView = { evidenceFor: () => [], hasOpenRequest: () => true };
    expect(find(assess(FULLY_KNOWN, { evidence }), "eu.gpsr.responsible-economic-operator")?.status).toBe("pending");
  });
});

describe("the assessment a consumer receives", () => {
  it("carries its citation, review date and confidence with it", () => {
    // D-008: a UI that has to fetch the citation separately is a UI that ships without it.
    const rp = find(assess(FULLY_KNOWN), "eu.gpsr.responsible-economic-operator");
    expect(rp?.citations.length).toBeGreaterThan(0);
    expect(rp?.citations[0]?.url).toMatch(/^https:\/\//);
    expect(rp).toHaveProperty("confidence");
    expect(rp).toHaveProperty("last_reviewed_at");
  });

  it("records which catalog version produced it", () => {
    // D-010: the cell has to say what it was computed against.
    const result = assess(FULLY_KNOWN);
    expect(result.catalog_version).toBe(catalog.version);
    expect(result.assessments.every((a) => a.catalog_version === catalog.version)).toBe(true);
  });
});

describe("the free scanner's view", () => {
  // The scanner is deterministic and account-free (D-009): it has the customer's spreadsheet
  // and nothing else.
  const result = assess(FULLY_KNOWN, { evidence: NO_EVIDENCE });

  it("can still clear a requirement that only ever needed data", () => {
    // Worth stating, because it is the scanner's whole pitch: a spreadsheet alone turns some
    // cells green, which is what makes the remaining red ones credible.
    const dataOnly = find(result, "eu.gpsr.manufacturer-identification");
    expect(dataOnly?.status).toBe("met");
  });

  it("can never clear a requirement that needs a document", () => {
    const needingDocuments = catalog.requirements
      .filter((r) => r.required_evidence.length > 0)
      .map((r) => find(result, r.id))
      .filter((a) => a !== undefined && a.status !== "na");

    expect(needingDocuments.length).toBeGreaterThan(0);
    expect(needingDocuments.every((a) => a!.status !== "met")).toBe(true);
  });

  it("never calls the SKU ready on a spreadsheet alone", () => {
    expect(result.market_ready).toBe(false);
  });
});

describe("requirements not yet in force", () => {
  it("are excluded from the assessment entirely", () => {
    const beforePpwr = assessProduct(
      catalog,
      { facts: FULLY_KNOWN, market: { iso_country: "DE" }, channel: { type: "amazon_de" } },
      { asOf: "2026-08-11" },
    );
    expect(find(beforePpwr, "eu.ppwr.producer-registration")).toBeUndefined();
  });

  it("appear once they apply", () => {
    const after = assessProduct(
      catalog,
      { facts: FULLY_KNOWN, market: { iso_country: "DE" }, channel: { type: "amazon_de" } },
      { asOf: "2026-08-12" },
    );
    expect(find(after, "eu.ppwr.producer-registration")).toBeDefined();
  });
});
