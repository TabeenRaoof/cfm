import { describe, expect, it } from "vitest";
import { extractDeterministically, remainingJsonSchema } from "../src/extract.ts";
import { normaliseDate, runPatterns } from "../src/patterns.ts";
import { EPR_CERTIFICATE, RP_MANDATE, TEST_REPORT } from "../src/schemas.ts";
import { toJsonSchema } from "../src/field.ts";

const REPORT = `
  SGS TESTING SERVICES
  Report No.: SZ-2026-004512
  Date of issue: 14/03/2026
  Standards: EN 71-1:2014+A1:2018, EN 71-3:2019
  Overall result: PASS
`;

describe("date normalisation", () => {
  it("passes ISO through", () => {
    expect(normaliseDate("2026-03-14")).toBe("2026-03-14");
  });

  it("reads unambiguous European dates", () => {
    expect(normaliseDate("14.03.2026")).toBe("2026-03-14");
    expect(normaliseDate("14/03/2026")).toBe("2026-03-14");
  });

  it("declines a slashed date that reads differently in Europe and the US", () => {
    // 03/04/2026 is 3 April in Europe and 4 March in the US, and a compliance document may be
    // either. Where the reading changes the answer, we decline rather than pick.
    expect(normaliseDate("03/04/2026")).toBeNull();
  });

  it("reads a dotted date as day-first, because that separator is European convention", () => {
    // The separator carries information; treating both the same throws it away.
    expect(normaliseDate("03.04.2026")).toBe("2026-04-03");
  });

  it("rejects an impossible month whichever separator is used", () => {
    expect(normaliseDate("14.13.2026")).toBeNull();
  });

  it("reads a mandate's 'Signed on' date, not only 'Date of issue'", () => {
    // Found live: a real RP-mandate smoke test escalated this to a model call because the
    // pattern only recognised issue-style labels. Mandates are dated by signature, not issue.
    const mandateText = "Appointed as responsible person.\nSigned on: 03.02.2026";
    const pass = extractDeterministically(RP_MANDATE, mandateText);
    const issueDate = pass.resolved.find((r) => r.key === "issue_date");
    expect(issueDate?.value).toBe("2026-02-03");
    expect(issueDate?.verified).toBe(true);
  });

  it("accepts one where both readings agree", () => {
    expect(normaliseDate("07.07.2026")).toBe("2026-07-07");
  });
});

describe("the deterministic pass", () => {
  const pass = extractDeterministically(TEST_REPORT, REPORT);

  it("finds the labelled fields with no model at all", () => {
    const byKey = Object.fromEntries(pass.resolved.map((r) => [r.key, r.value]));
    expect(byKey["report_number"]).toBe("SZ-2026-004512");
    expect(byKey["issue_date"]).toBe("2026-03-14");
  });

  it("collects every standard, because that field really is a list", () => {
    const standards = pass.resolved.find((r) => r.key === "standards")?.value;
    expect(standards).toEqual(["EN 71-1:2014+A1:2018", "EN 71-3:2019"]);
  });

  it("reports what is left for a model", () => {
    expect(pass.remaining).toContain("lab_name");
    expect(pass.remaining).not.toContain("report_number");
  });

  it("reports coverage, so the saving is measurable", () => {
    expect(pass.coverage).toBeGreaterThanOrEqual(0.3);
  });

  it("resolves nothing from a scan with no text layer", () => {
    const blank = extractDeterministically(TEST_REPORT, "");
    expect(blank.resolved).toEqual([]);
    expect(blank.remaining).toHaveLength(TEST_REPORT.fields.length);
  });
});

describe("ambiguity", () => {
  it("declines to choose when two plausible values appear", () => {
    // Two dates on a page is exactly when a human should look. Choosing the first would be
    // free and wrong.
    const twoDates = "Date of issue: 01.02.2026 ... Issue date: 03.03.2026";
    const { hits, ambiguous } = runPatterns(twoDates);
    expect(hits.find((h) => h.fieldKey === "issue_date")).toBeUndefined();
    expect(ambiguous.find((a) => a.fieldKey === "issue_date")?.candidates).toEqual([
      "2026-02-01", "2026-03-03",
    ]);
  });

  it("does not carry regex state between documents", () => {
    // A global regex keeps lastIndex; the classic bug is that the second document in a batch
    // silently matches nothing.
    const first = runPatterns(REPORT);
    const second = runPatterns(REPORT);
    expect(second.hits).toEqual(first.hits);
    expect(second.hits.length).toBeGreaterThan(0);
  });
});

describe("unverified patterns", () => {
  it("mark their result as needing confirmation rather than accepting it", () => {
    const pass = extractDeterministically(EPR_CERTIFICATE, "Registrierungsnummer DE1234567890123");
    const found = pass.resolved.find((r) => r.key === "registration_number");
    expect(found?.value).toBe("DE1234567890123");
    expect(found?.verified).toBe(false);
  });
});

describe("the schema sent to a model", () => {
  it("asks only for what the deterministic pass could not answer", () => {
    // Asking a model to restate a value we already hold spends tokens on both sides and invites
    // it to disagree with a regex that was right.
    const pass = extractDeterministically(TEST_REPORT, REPORT);
    const narrowed = remainingJsonSchema(TEST_REPORT, pass);
    const properties = Object.keys(narrowed["properties"] as object);

    expect(properties).not.toContain("report_number");
    expect(properties).not.toContain("issue_date");
    expect(properties).toContain("lab_name");
  });

  it("drops resolved fields from required as well as from properties", () => {
    const pass = extractDeterministically(TEST_REPORT, REPORT);
    const narrowed = remainingJsonSchema(TEST_REPORT, pass);
    expect(narrowed["required"]).not.toContain("report_number");
  });

  it("is smaller than the full schema, which is the point", () => {
    const pass = extractDeterministically(TEST_REPORT, REPORT);
    const full = JSON.stringify(toJsonSchema(TEST_REPORT)).length;
    const narrowed = JSON.stringify(remainingJsonSchema(TEST_REPORT, pass)).length;
    expect(narrowed).toBeLessThan(full);
  });

  it("is closed, so two providers' output stays comparable", () => {
    expect(toJsonSchema(TEST_REPORT)["additionalProperties"]).toBe(false);
  });
});
