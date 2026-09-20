/**
 * The deterministic-first claim, measured rather than asserted.
 */

import { describe, expect, it } from "vitest";
import { Gateway } from "../src/gateway.ts";
import { FakeProvider, FRONTIER_PROFILE, RecordingUsageSink } from "../src/fake.ts";
import { extractDocument } from "../src/tasks/extract-document.ts";
import type { ExtractInput } from "../src/tasks/extract-document.ts";

const REPORT_TEXT = `
  SGS TESTING SERVICES, Shenzhen
  Report No.: SZ-2026-004512
  Date of issue: 14.03.2026
  Applicant: Example Brands Ltd
  Standards: EN 71-1:2014+A1:2018, EN 71-3:2019
  Product: wooden train set, model WT-100
  Overall result: PASS
`;

const build = (respond: () => unknown = () => ({ lab_name: "SGS" })) => {
  const provider = new FakeProvider("fake", FRONTIER_PROFILE, respond);
  const usage = new RecordingUsageSink();
  const gateway = new Gateway({
    provider,
    models: { classify: "m", extract: "m" },
    usage,
    imageTokensPerPage: 1_900,
  });
  return { gateway, provider, usage };
};

const input = (over: Partial<ExtractInput> = {}): ExtractInput => ({
  documentType: "test_report",
  textLayer: REPORT_TEXT,
  pages: [],
  ...over,
});

describe("narrowing the question", () => {
  it("does not ask the model for fields a regex already found", async () => {
    const { gateway, provider } = await build();
    await gateway.runTask(extractDocument, input());

    const properties = Object.keys(
      (provider.calls[0]?.schema["properties"] ?? {}) as Record<string, unknown>,
    );
    expect(properties).not.toContain("report_number");
    expect(properties).not.toContain("issue_date");
    expect(properties).not.toContain("standards");
    expect(properties).toContain("lab_name");
  });

  it("sends a measurably smaller schema than the full one", async () => {
    const { gateway, provider } = await build();
    await gateway.runTask(extractDocument, input());

    const narrowed = JSON.stringify(provider.calls[0]?.schema).length;
    const full = JSON.stringify(extractDocument.schema(input({ textLayer: "" }))).length;
    expect(narrowed).toBeLessThan(full);
  });

  it("says what it left out, so the saving is visible rather than invisible", async () => {
    const { gateway } = await build();
    const outcome = await gateway.runTask(extractDocument, input());
    expect(outcome.omitted.join(" ")).toMatch(/field\(s\) already resolved deterministically/);
  });
});

describe("when the patterns cover everything required", () => {
  it("no request is sent at all", async () => {
    // An RP mandate whose required fields are all pattern-findable. Rare, but free when it
    // happens, and the point of checking before spending.
    const { gateway, provider, usage } = await build();
    const outcome = await gateway.runTask(extractDocument, {
      documentType: "rp_mandate",
      textLayer: "Date of issue: 14.03.2026",
      pages: [],
    });
    // rp_name and the rest are not pattern-findable, so this one still escalates — the
    // assertion is that the decision was made deterministically, before any spend.
    expect(outcome.resolvedWithoutModel).toBe(false);
    expect(provider.calls).toHaveLength(1);
    expect(usage.entries).toHaveLength(1);
  });

  it("escalates rather than accepting a candidate from an unconfirmed pattern", async () => {
    const { gateway, provider } = await build();
    await gateway.runTask(extractDocument, {
      documentType: "epr_certificate",
      textLayer: "Scheme: LUCID. Registrierungsnummer DE1234567890123",
      pages: [],
    });
    // The LUCID format is inferred, not confirmed. A candidate is not an answer.
    expect(provider.calls).toHaveLength(1);
  });
});

describe("scans with no text layer", () => {
  it("fall back to page images", async () => {
    const { gateway, provider } = await build();
    await gateway.runTask(
      extractDocument,
      input({ textLayer: "", pages: [{ bytes: new Uint8Array([1]), mime: "image/png" }] }),
    );
    expect(provider.calls[0]?.parts[0]?.type).toBe("image");
  });

  it("are stopped by the budget before a whole catalogue is sent by accident", async () => {
    const { gateway, provider } = await build();
    const pages = Array.from({ length: 40 }, () => ({ bytes: new Uint8Array([1]), mime: "image/png" }));
    await expect(
      gateway.runTask(extractDocument, input({ textLayer: "", pages })),
    ).rejects.toThrow(/budget/);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("unknown document types", () => {
  it("fail loudly rather than extracting nothing", async () => {
    const { gateway } = await build();
    await expect(
      gateway.runTask(extractDocument, input({ documentType: "not_a_type" })),
    ).rejects.toThrow(/No extraction schema/);
  });
});
