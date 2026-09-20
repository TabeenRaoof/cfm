import { describe, expect, it } from "vitest";
import { renderSupplierRequestEmail, type SupplierRequestEmailParams } from "../src/templates.ts";

function baseParams(overrides: Partial<SupplierRequestEmailParams> = {}): SupplierRequestEmailParams {
  return {
    requesterOrganisationName: "Nordholt Trading GmbH",
    supplierContactName: "Wei Zhang",
    requestedItemLabels: ["Responsible person mandate", "EPR registration certificate"],
    dueAtDate: "2026-10-15",
    magicLinkUrl: "https://app.example.com/supplier-upload?request=req_1&token=abc",
    reminderNumber: null,
    ...overrides,
  };
}

describe("renderSupplierRequestEmail — English", () => {
  it("names the requester, the items and the link in the initial request", () => {
    const email = renderSupplierRequestEmail("en", baseParams());
    expect(email.subject).toContain("Nordholt Trading GmbH");
    expect(email.subject).not.toMatch(/Reminder/i);
    expect(email.body).toContain("Responsible person mandate");
    expect(email.body).toContain("EPR registration certificate");
    expect(email.body).toContain("https://app.example.com/supplier-upload?request=req_1&token=abc");
    expect(email.body).toContain("15 October 2026");
  });

  it("greets by name when one is known, and falls back generically when it isn't", () => {
    const named = renderSupplierRequestEmail("en", baseParams({ supplierContactName: "Wei Zhang" }));
    expect(named.body).toContain("Hi Wei Zhang,");

    const unnamed = renderSupplierRequestEmail("en", baseParams({ supplierContactName: null }));
    expect(unnamed.body).toContain("Hello,");
    expect(unnamed.body).not.toContain("null");
  });

  it("marks a reminder distinctly from the first send", () => {
    const email = renderSupplierRequestEmail("en", baseParams({ reminderNumber: 1 }));
    expect(email.subject).toMatch(/^Reminder:/);
    expect(email.body).toMatch(/still waiting/i);
  });
});

describe("renderSupplierRequestEmail — Chinese", () => {
  it("renders the requester name, items and link in Chinese", () => {
    const email = renderSupplierRequestEmail("zh", baseParams());
    expect(email.subject).toContain("Nordholt Trading GmbH");
    expect(email.body).toContain("Responsible person mandate");
    expect(email.body).toContain("https://app.example.com/supplier-upload?request=req_1&token=abc");
    expect(email.body).toContain("2026年10月15日");
  });

  it("marks a reminder distinctly from the first send", () => {
    const email = renderSupplierRequestEmail("zh", baseParams({ reminderNumber: 1 }));
    expect(email.subject).toContain("【提醒】");
  });

  it("greets by name when known and falls back generically otherwise", () => {
    const named = renderSupplierRequestEmail("zh", baseParams({ supplierContactName: "张伟" }));
    expect(named.body).toContain("张伟，您好：");
    const unnamed = renderSupplierRequestEmail("zh", baseParams({ supplierContactName: null }));
    expect(unnamed.body.startsWith("您好：")).toBe(true);
  });
});

describe("date parsing", () => {
  it("throws rather than silently mis-rendering a non-ISO date", () => {
    expect(() => renderSupplierRequestEmail("en", baseParams({ dueAtDate: "15/10/2026" }))).toThrow(
      /ISO date/,
    );
  });
});
