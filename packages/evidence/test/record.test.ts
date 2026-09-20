import { describe, expect, it } from "vitest";
import type { ExtractionVerdict } from "@cfm/documents";
import { evidenceFromVerdict } from "../src/record.ts";

function acceptedVerdict(
  fields: readonly { readonly key: string; readonly value: string | number | readonly string[] | null }[],
): ExtractionVerdict {
  return {
    decision: "accept",
    reasons: [],
    fields: fields.map((f) => ({
      key: f.key,
      label: f.key,
      value: f.value,
      source: "pattern",
      required: true,
      validation: { verdict: "valid" },
      needsConfirmation: false,
    })),
    missingRequired: [],
    invalidFields: [],
  };
}

describe("evidenceFromVerdict", () => {
  it("carries every field value through, keyed the same as the extraction", () => {
    const verdict = acceptedVerdict([
      { key: "country", value: "DE" },
      { key: "scheme_name", value: "LUCID" },
      { key: "valid_to", value: "2027-01-01" },
    ]);

    const record = evidenceFromVerdict("doc_1", "epr_certificate", verdict);

    expect(record.documentId).toBe("doc_1");
    expect(record.type).toBe("epr_certificate");
    expect(record.values).toEqual({ country: "DE", scheme_name: "LUCID", valid_to: "2027-01-01" });
  });

  it("derives validTo from the valid_to field when present", () => {
    const verdict = acceptedVerdict([{ key: "valid_to", value: "2027-06-30" }]);
    const record = evidenceFromVerdict("doc_2", "epr_certificate", verdict);
    expect(record.validTo).toBe("2027-06-30");
  });

  it("is null, not undefined or a throw, when the schema has no valid_to field at all", () => {
    // rp_mandate's schema has no valid_to among its required fields in every case; a document
    // stating no expiry is not an error, it is an honest absence.
    const verdict = acceptedVerdict([{ key: "rp_name", value: "Example EU Rep GmbH" }]);
    const record = evidenceFromVerdict("doc_3", "rp_mandate", verdict);
    expect(record.validTo).toBeNull();
  });

  it("refuses to build evidence from a verdict that needed review", () => {
    const reviewVerdict: ExtractionVerdict = {
      decision: "review",
      reasons: ["Required field(s) not found: country."],
      fields: [],
      missingRequired: ["country"],
      invalidFields: [],
    };

    expect(() => evidenceFromVerdict("doc_4", "epr_certificate", reviewVerdict)).toThrow(
      /was not accepted/,
    );
  });
});
