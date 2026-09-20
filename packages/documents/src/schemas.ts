/**
 * The document types the product extracts, per `02-` §6.2.
 *
 * Slice B needs the first two: an RP mandate and an EPR certificate are short, structurally
 * simple, and each one directly turns a red cell green. Test reports and declarations of
 * conformity are defined here too because their shape governs the v2 verification module
 * (`02-` §7) and it is cheaper to get the data model right once.
 */

import type { DocumentSchema } from "./field.ts";

export const RP_MANDATE: DocumentSchema = {
  type: "rp_mandate",
  label: "Responsible person mandate",
  fields: [
    { key: "rp_name", label: "Responsible person", kind: "string", required: true,
      description: "Legal name of the party appointed as EU responsible person." },
    { key: "rp_address", label: "Address", kind: "string", required: true,
      description: "Full postal address of the responsible person, which must be in the EU." },
    { key: "rp_country", label: "Country", kind: "country", required: true,
      description: "Country of the responsible person's address." },
    { key: "rp_contact", label: "Contact", kind: "string", required: false,
      description: "Email address or URL given for contacting the responsible person." },
    { key: "manufacturer_name", label: "Appointed by", kind: "string", required: true,
      description: "The manufacturer or seller making the appointment." },
    { key: "issue_date", label: "Signed on", kind: "date", required: true,
      description: "Date the mandate was signed.",
      pattern: { id: "issue_date_labelled", verified: true } },
    { key: "valid_to", label: "Expires", kind: "date", required: false,
      description: "Date the mandate expires, if it states one." },
    { key: "product_scope", label: "Products covered", kind: "string", required: false,
      description: "How the mandate describes which products it covers — a category, a list, or all." },
  ],
};

export const EPR_CERTIFICATE: DocumentSchema = {
  type: "epr_certificate",
  label: "EPR registration certificate",
  fields: [
    { key: "scheme_name", label: "Scheme", kind: "string", required: true,
      description: "The register or compliance scheme, e.g. LUCID, Citeo, CONAI." },
    { key: "country", label: "Country", kind: "country", required: true,
      description: "Country the registration is for." },
    { key: "registration_number", label: "Registration number", kind: "string", required: true,
      description: "The registration or producer number issued by the scheme.",
      pattern: { id: "lucid_number", verified: false } },
    { key: "registered_name", label: "Registered to", kind: "string", required: true,
      description: "The business the registration is held by." },
    { key: "packaging_types", label: "Packaging covered", kind: "string_array", required: false,
      description: "Packaging categories the registration covers, if listed." },
    { key: "issue_date", label: "Issued", kind: "date", required: false,
      description: "Date the registration was issued.",
      pattern: { id: "issue_date_labelled", verified: true } },
    { key: "valid_to", label: "Valid to", kind: "date", required: false,
      description: "Date the registration expires, if stated." },
  ],
};

export const TEST_REPORT: DocumentSchema = {
  type: "test_report",
  label: "Test report",
  fields: [
    { key: "lab_name", label: "Laboratory", kind: "string", required: true,
      description: "Name of the testing laboratory." },
    { key: "accreditation_body", label: "Accreditation body", kind: "string", required: false,
      description: "The accreditation body named, e.g. UKAS, DAkkS. Null if none is stated." },
    { key: "accreditation_number", label: "Accreditation number", kind: "string", required: false,
      description: "The laboratory's accreditation number, if stated." },
    { key: "report_number", label: "Report number", kind: "string", required: true,
      description: "The report's own reference number.",
      pattern: { id: "report_number_labelled", verified: true } },
    { key: "issue_date", label: "Issued", kind: "date", required: true,
      description: "Date the report was issued.",
      pattern: { id: "issue_date_labelled", verified: true } },
    { key: "applicant", label: "Applicant", kind: "string", required: false,
      description: "The party that commissioned the testing." },
    { key: "product_description", label: "Product tested", kind: "string", required: true,
      description: "How the report describes the item tested." },
    { key: "model_numbers", label: "Model numbers", kind: "string_array", required: false,
      description: "Model or type references the report covers." },
    { key: "standards", label: "Standards", kind: "string_array", required: true,
      description: "Standards tested against, with version and amendments as printed.",
      pattern: { id: "standard_reference", verified: true } },
    { key: "overall_result", label: "Result", kind: "enum", required: true,
      values: ["pass", "fail", "partial", "unclear"],
      description: "The report's own overall conclusion. Use 'unclear' rather than inferring one." },
  ],
};

export const DECLARATION_OF_CONFORMITY: DocumentSchema = {
  type: "declaration_of_conformity",
  label: "Declaration of conformity",
  fields: [
    { key: "manufacturer_name", label: "Manufacturer", kind: "string", required: true,
      description: "The manufacturer making the declaration." },
    { key: "manufacturer_address", label: "Manufacturer address", kind: "string", required: true,
      description: "Full postal address of the manufacturer." },
    { key: "product_description", label: "Product", kind: "string", required: true,
      description: "How the declaration identifies the product." },
    { key: "model_numbers", label: "Model numbers", kind: "string_array", required: false,
      description: "Model or type references covered by the declaration." },
    { key: "legislation", label: "Legislation", kind: "string_array", required: true,
      description: "The directives or regulations declared against." },
    { key: "standards", label: "Standards", kind: "string_array", required: false,
      description: "Harmonised standards referenced.",
      pattern: { id: "standard_reference", verified: true } },
    { key: "signatory_name", label: "Signed by", kind: "string", required: false,
      description: "Name of the signatory." },
    { key: "issue_date", label: "Signed on", kind: "date", required: true,
      description: "Date of the declaration.",
      pattern: { id: "issue_date_labelled", verified: true } },
    { key: "place_of_issue", label: "Place", kind: "string", required: false,
      description: "Place of issue, if stated." },
  ],
};

export const SCHEMAS: readonly DocumentSchema[] = [
  RP_MANDATE,
  EPR_CERTIFICATE,
  TEST_REPORT,
  DECLARATION_OF_CONFORMITY,
];

export function schemaFor(type: string): DocumentSchema | undefined {
  return SCHEMAS.find((s) => s.type === type);
}
