import { describe, expect, it } from "vitest";
import { buildCatalog, inForce } from "../src/catalog.ts";
import type { Requirement } from "../src/types.ts";
import { loadRealCatalog } from "./fixtures.ts";

const draft = (overrides: Partial<Requirement> = {}): Requirement =>
  ({
    id: "eu.test.example",
    version: "2026.09",
    state: "draft",
    jurisdiction: "EU",
    regulation: "Example Regulation",
    article_ref: "Art. 1",
    title: "Example",
    summary: "An example requirement used by the tests.",
    applies_when: { always: true },
    required_data: [],
    required_evidence: [],
    channel_mappings: {},
    effective_from: "2020-01-01",
    effective_to: null,
    sources: [{ title: "Example", url: "https://example.org", retrieved_at: null, verified: false }],
    confidence: "medium",
    last_reviewed_at: null,
    reviewer: null,
    ...overrides,
  }) as Requirement;

const build = (requirements: Requirement[], includeDrafts = false) =>
  buildCatalog(
    requirements.map((r, i) => ({ file: `${r.id}-${i}.json`, data: r })),
    { version: "test", includeDrafts },
  );

describe("the publish gate", () => {
  it("withholds drafts from the live catalog", () => {
    const result = build([draft()]);
    expect(result.catalog.requirements).toHaveLength(0);
    expect(result.withheldDrafts).toEqual(["eu.test.example"]);
    expect(result.issues).toEqual([]);
  });

  it("lets drafts through only when a caller explicitly asks", () => {
    expect(build([draft()], true).catalog.requirements).toHaveLength(1);
  });

  it("refuses to publish a requirement nobody has reviewed", () => {
    const result = build([draft({ state: "published" })]);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain("reviewer");
    expect(paths).toContain("last_reviewed_at");
    expect(paths).toContain("sources");
  });

  it("publishes once a named human has read a dated primary source", () => {
    const result = build([
      draft({
        state: "published",
        reviewer: "TR",
        last_reviewed_at: "2026-09-12",
        sources: [
          { title: "EUR-Lex", url: "https://eur-lex.europa.eu/x", retrieved_at: "2026-09-12", verified: true },
        ],
      }),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.catalog.requirements).toHaveLength(1);
  });
});

describe("validation", () => {
  it("rejects an empty condition array rather than silently applying to everything", () => {
    // `{ all: [] }` is vacuously true, so this would switch a requirement on for every SKU.
    const result = build([draft({ applies_when: { all: [] } })], true);
    expect(result.issues.map((i) => i.message).join(" ")).toMatch(/non-empty array/);
  });

  it("catches a misspelled fact path, which would otherwise be unknown forever", () => {
    const result = build([draft({ applies_when: { "prodcut.is_toy": true } })], true);
    expect(result.issues.map((i) => i.message).join(" ")).toMatch(/Unrecognised fact path/);
  });

  it("rejects a requirement with no source at all", () => {
    const result = build([draft({ sources: [] })], true);
    expect(result.issues.map((i) => i.path)).toContain("sources");
  });

  it("rejects duplicate ids", () => {
    const result = build([draft(), draft()], true);
    expect(result.issues.map((i) => i.message).join(" ")).toMatch(/Duplicate requirement id/);
  });
});

describe("effective dates", () => {
  it("excludes a requirement that is not yet in force", () => {
    expect(inForce(draft({ effective_from: "2027-01-01" }), "2026-09-12")).toBe(false);
  });

  it("excludes a requirement that has been withdrawn", () => {
    expect(inForce(draft({ effective_to: "2026-01-01" }), "2026-09-12")).toBe(false);
  });

  it("includes one in force today", () => {
    expect(inForce(draft(), "2026-09-12")).toBe(true);
  });
});

describe("the requirement files in this repository", () => {
  it("all validate", async () => {
    const { issues } = await loadRealCatalog(true);
    expect(issues).toEqual([]);
  });

  it("publishes only what Tabeen has actually signed off, and withholds the rest", async () => {
    // Every entry was drafted from the technical plan's own article references, which that
    // plan says must be verified against EUR-Lex before publishing. The first review packet
    // (2026-09-20, project-setup/review-packet-2026-09-20.md) published five; the second
    // (project-setup/review-packet-2026-09-20b.md) published three more and held one
    // (uk.gpsr.uk-responsible-person — a scoping question, not a citation fix); the third
    // (project-setup/review-packet-2026-09-20c.md) published four more and held one more
    // (eu.ppwr.authorised-representative — a scoping question, not a citation fix); that hold
    // was then resolved by rescoping applies_when (D-040, PR #5) and published on its own. The
    // fourth (project-setup/review-packet-2026-09-20d.md) published four national packaging-EPR
    // rows outright and held three more for the same reason (AT/BE/IT scoping questions); all
    // three were then rescoped per Tabeen's PR #6 review and published in the same pass. The
    // fifth (project-setup/review-packet-2026-09-20e.md) published the last seven drafts
    // outright — batteries, toys, WEEE and UK marking — with no scoping questions, only two
    // date-bug fixes caught by reading commencement clauses. That leaves exactly one draft
    // withheld: uk.gpsr.uk-responsible-person, held on legislation (PRMA 2025's secondary
    // legislation hasn't landed yet), not on research. This test is expected to grow that set
    // one review packet at a time, not to jump back to zero.
    const { catalog, withheldDrafts } = await loadRealCatalog(false);
    const publishedIds = catalog.requirements.map((r) => r.id).sort();
    expect(publishedIds).toEqual(
      [
        "at.epr.authorised-representative",
        "at.epr.packaging-edm",
        "be.epr.packaging-ivc",
        "de.epr.packaging-lucid",
        "es.epr.authorised-representative",
        "es.epr.packaging-rpp",
        "eu.dsa.trader-information",
        "eu.flag.battery-registration",
        "eu.flag.toy-safety",
        "eu.flag.weee-registration",
        "eu.gpsr.distance-selling-information",
        "eu.gpsr.manufacturer-identification",
        "eu.gpsr.responsible-economic-operator",
        "eu.gpsr.technical-documentation",
        "eu.ppwr.authorised-representative",
        "eu.ppwr.producer-registration",
        "fr.epr.packaging-citeo",
        "fr.epr.packaging-triman-marking",
        "it.epr.packaging-conai",
        "nl.epr.packaging-verpact",
        "uk.batteries.producer-registration",
        "uk.epr.packaging-registration",
        "uk.gpsr.general-safety-requirement",
        "uk.importer.identification",
        "uk.marking.ukca-or-ce",
        "uk.toys.safety",
        "uk.weee.producer-registration",
      ].sort(),
    );
    expect(withheldDrafts.length).toBe(1);
  });
});
