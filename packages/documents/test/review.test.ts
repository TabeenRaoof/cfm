import { describe, expect, it } from "vitest";
import { extractDeterministically } from "../src/extract.ts";
import { gateExtraction } from "../src/review.ts";
import { EPR_CERTIFICATE, RP_MANDATE } from "../src/schemas.ts";

const gate = (
  schema: typeof RP_MANDATE,
  text: string,
  modelValues: Record<string, unknown>,
  asOf = "2026-09-13",
) =>
  gateExtraction({
    schema,
    pass: extractDeterministically(schema, text),
    modelValues: modelValues as never,
    asOf,
  });

const COMPLETE_MANDATE = {
  rp_name: "Example EU Rep GmbH",
  rp_address: "1 Beispielstraße, 10115 Berlin",
  rp_country: "DE",
  rp_contact: "rp@example.com",
  manufacturer_name: "Shenzhen Example Co",
  issue_date: "2026-01-15",
};

describe("auto-acceptance", () => {
  it("happens when everything required is present and every check passes", () => {
    const verdict = gate(RP_MANDATE, "", COMPLETE_MANDATE);
    expect(verdict.decision).toBe("accept");
    expect(verdict.reasons).toEqual([]);
  });

  it("is refused when a required field is missing", () => {
    const { rp_country, ...missing } = COMPLETE_MANDATE;
    void rp_country;
    const verdict = gate(RP_MANDATE, "", missing);
    expect(verdict.decision).toBe("review");
    expect(verdict.missingRequired).toContain("rp_country");
  });

  it("is refused when a validator says the value is wrong", () => {
    const verdict = gate(RP_MANDATE, "", { ...COMPLETE_MANDATE, rp_country: "Germany" });
    expect(verdict.decision).toBe("review");
    expect(verdict.reasons.join(" ")).toMatch(/ISO 3166-1 alpha-2/);
  });

  it("is refused when the document is dated in the future", () => {
    const verdict = gate(RP_MANDATE, "", { ...COMPLETE_MANDATE, issue_date: "2027-06-01" });
    expect(verdict.decision).toBe("review");
    expect(verdict.reasons.join(" ")).toMatch(/in the future/);
  });

  it("is refused when an expiry precedes the issue date", () => {
    const verdict = gate(RP_MANDATE, "", { ...COMPLETE_MANDATE, valid_to: "2025-01-01" });
    expect(verdict.decision).toBe("review");
    expect(verdict.reasons.join(" ")).toMatch(/is not after valid-from/);
  });
});

describe("the model does not score its own work", () => {
  it("ignores any confidence the model volunteers", () => {
    // A self-reported confidence is the one number a model cannot calibrate. Letting it gate
    // acceptance would mean the same component decides the answer and whether it is good enough.
    const verdict = gate(RP_MANDATE, "", { ...COMPLETE_MANDATE, confidence: 0.99, rp_country: "XX1" });
    expect(verdict.decision).toBe("review");
  });
});

describe("unverified patterns", () => {
  it("force a look even when everything else is fine", () => {
    const verdict = gate(
      EPR_CERTIFICATE,
      "Registrierungsnummer DE1234567890123",
      { scheme_name: "LUCID", country: "DE", registered_name: "Example Brands Ltd" },
    );
    expect(verdict.decision).toBe("review");
    expect(verdict.reasons.join(" ")).toMatch(/format is not confirmed/);
  });

  it("still record the value, so the human is confirming rather than transcribing", () => {
    const verdict = gate(
      EPR_CERTIFICATE,
      "Registrierungsnummer DE1234567890123",
      { scheme_name: "LUCID", country: "DE", registered_name: "Example Brands Ltd" },
    );
    const field = verdict.fields.find((f) => f.key === "registration_number");
    expect(field?.value).toBe("DE1234567890123");
    expect(field?.source).toBe("pattern");
    expect(field?.needsConfirmation).toBe(true);
  });
});

describe("ambiguity reaches the review card", () => {
  it("is reported with both candidates rather than resolved", () => {
    const verdict = gate(
      RP_MANDATE,
      "Date of issue: 01.02.2026 ... Issue date: 03.03.2026",
      COMPLETE_MANDATE,
    );
    expect(verdict.decision).toBe("review");
    expect(verdict.reasons.join(" ")).toMatch(/more than one plausible value/);
  });
});

describe("the review card", () => {
  it("carries every field with where it came from, so a human can check the work", () => {
    const verdict = gate(RP_MANDATE, "", COMPLETE_MANDATE);
    expect(verdict.fields).toHaveLength(RP_MANDATE.fields.length);
    expect(verdict.fields.every((f) => ["pattern", "model", "absent"].includes(f.source))).toBe(true);
  });

  it("distinguishes a field no rule could check from one that passed", () => {
    // Free text cannot be validated deterministically. "Undetermined" is not "valid" — it just
    // does not block acceptance on a check that could never exist.
    const verdict = gate(RP_MANDATE, "", COMPLETE_MANDATE);
    expect(verdict.fields.find((f) => f.key === "rp_name")?.validation.verdict).toBe("undetermined");
    expect(verdict.fields.find((f) => f.key === "rp_country")?.validation.verdict).toBe("valid");
  });

  it("gives a reason per problem, which are the card's headings", () => {
    const verdict = gate(RP_MANDATE, "", { rp_name: "X", rp_country: "Germany" });
    expect(verdict.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
