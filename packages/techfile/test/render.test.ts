import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assessProduct } from "@cfm/catalog";
import { loadCatalogFromDir } from "@cfm/catalog/node";
import type { EvidenceView } from "@cfm/catalog";
import { esc, renderTechnicalFile } from "../src/render.ts";

const catalogRoot = new URL("../../catalog/", import.meta.url).pathname;
const manifest = JSON.parse(await readFile(join(catalogRoot, "catalog.json"), "utf8")) as { version: string };
const { catalog } = await loadCatalogFromDir(join(catalogRoot, "requirements"), {
  version: manifest.version,
  includeDrafts: true,
});

const FACTS = {
  "manufacturer.country": "CN",
  "manufacturer.name": "Shenzhen Example Co",
  "manufacturer.address": "1 Example Road, Shenzhen",
  "organisation.establishment_country": "GB",
  "product.has_packaging": true,
  "product.is_toy": true,
};

const render = (facts: Record<string, unknown> = FACTS, evidence?: EvidenceView, title: string | null = "Wooden train set") =>
  renderTechnicalFile({
    sku: "TOY-001",
    title,
    organisationName: "Example Brands Ltd",
    generatedAt: "2026-09-13",
    assessment: assessProduct(
      catalog,
      { facts: facts as never, market: { iso_country: "DE" }, channel: { type: "amazon_de" } },
      { asOf: "2026-09-13", ...(evidence ? { evidence } : {}) },
    ),
  });

describe("what the document must never say", () => {
  const html = render().toLowerCase();

  // This is the document a seller would hand to an authority. A confident phrase here does more
  // damage than anywhere else in the product, so the forbidden words are asserted rather than
  // left to reviewer judgement (tabeen_AGENTS.md, "Accuracy and liability honesty").
  it.each([
    "is compliant",
    "fully compliant",
    "certified",
    "approved",
    "guarantee",
    "meets all requirements",
    "legal advice",
  ])("never claims %s", (phrase) => {
    if (phrase === "legal advice") {
      // The only permitted appearance is the disclaimer denying it.
      expect(html).toContain("not legal advice");
      return;
    }
    expect(html).not.toContain(phrase);
  });

  it("states plainly what it is not", () => {
    expect(html).toContain("not a declaration of conformity");
    expect(html).toContain("not a certification");
  });
});

describe("undetermined requirements", () => {
  it("get their own section, ahead of the outstanding ones", () => {
    const html = render();
    const undetermined = html.indexOf("Could not be determined");
    const outstanding = html.indexOf(">Outstanding");
    expect(undetermined).toBeGreaterThan(-1);
    // A reader skimming for problems must meet the undecidable ones before the merely missing.
    expect(undetermined).toBeLessThan(outstanding);
  });

  it("say explicitly that they are neither excluded nor satisfied", () => {
    const html = render({ ...FACTS, "product.is_toy": undefined });
    expect(html).toContain("not excluded and they are not satisfied");
  });

  it("name the information that would resolve them", () => {
    const html = render({ "manufacturer.country": "CN" });
    expect(html).toMatch(/Needs: [^<]*product\.has_packaging/);
  });

  it("say so when there are none, rather than rendering an empty section", () => {
    // An absent section reads as reassurance. It has to be a positive statement.
    const html = render({ ...FACTS, "product.has_battery": false, "product.is_electrical": false });
    expect(html).toMatch(/Could not be determined[\s\S]*?(None\.|<span class="count">)/);
  });
});

describe("citations", () => {
  it("accompany every rendered requirement", () => {
    const html = render();
    const requirements = html.match(/class="req /g) ?? [];
    const citations = html.match(/class="cite"/g) ?? [];
    expect(requirements.length).toBeGreaterThan(3);
    expect(citations.length).toBe(requirements.length);
  });

  it("carry the review date and confidence, not just a link", () => {
    const html = render();
    expect(html).toContain("confidence ");
    expect(html).toContain("not yet reviewed");
  });
});

describe("provenance", () => {
  it("stamps the catalog version and the assessment date", () => {
    const html = render();
    expect(html).toContain(catalog.version);
    expect(html).toContain("2026-09-13");
  });

  it("records what was excluded and on what grounds", () => {
    const html = render();
    expect(html).toContain("Not applicable");
    // The French scheme does not apply in Germany; the reasoning should be visible.
    expect(html).toContain("Triman");
  });
});

describe("evidence", () => {
  it("moves a requirement into the evidenced section once documents are linked", () => {
    const evidence: EvidenceView = {
      evidenceFor: (id) =>
        id === "eu.gpsr.responsible-economic-operator" ? [{ type: "rp_mandate", valid_to: "2028-01-01" }] : [],
      hasOpenRequest: () => false,
    };
    const withEvidence = render({ ...FACTS, "rp.name": "R", "rp.address": "A", "rp.contact": "c@e.com" }, evidence);
    expect(withEvidence).toMatch(/Evidenced[\s\S]*EU-established responsible economic operator/);
  });

  it("flags expired documents distinctly from missing ones", () => {
    const evidence: EvidenceView = {
      evidenceFor: (id) =>
        id === "eu.gpsr.responsible-economic-operator" ? [{ type: "rp_mandate", valid_to: "2020-01-01" }] : [],
      hasOpenRequest: () => false,
    };
    const html = render({ ...FACTS, "rp.name": "R", "rp.address": "A", "rp.contact": "c@e.com" }, evidence);
    expect(html).toContain("Expired:");
  });
});

describe("untrusted input", () => {
  it("escapes a product title, which comes from a customer's spreadsheet", () => {
    // This document gets shared with retailers and authorities; an injected script travels
    // with it.
    const html = render(FACTS, undefined, '<script>alert("x")</script>');
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the five characters that matter", () => {
    expect(esc(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("the document as a whole", () => {
  it("is self-contained — no external stylesheet, script or image", () => {
    const html = render();
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/<img/);
  });

  it("counts evidenced requirements rather than asserting a percentage", () => {
    // "70% compliant" is a claim we are not entitled to make; "3 of 9 evidenced" is a fact.
    const html = render();
    expect(html).toMatch(/\d+ of \d+ applicable requirements have evidence recorded/);
    expect(html).not.toMatch(/\d+% compliant/);
  });
});
