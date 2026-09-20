import { describe, expect, it } from "vitest";
import { Gateway, NeedsRenderedPagesError } from "../src/gateway.ts";
import { BudgetExceededError } from "../src/task.ts";
import type { TaskDefinition } from "../src/task.ts";
import { cacheBreakEvenReads } from "../src/provider.ts";
import { FakeProvider, FRONTIER_PROFILE, RecordingUsageSink, SMALL_PROFILE } from "../src/fake.ts";
import { classifyDocument } from "../src/tasks/classify-document.ts";
import type { ClassifyInput } from "../src/tasks/classify-document.ts";

const input = (over: Partial<ClassifyInput> = {}): ClassifyInput => ({
  filename: "scan.pdf",
  textLayer: "",
  firstPages: [{ bytes: new Uint8Array([1, 2, 3]), mime: "image/png" }],
  ...over,
});

const build = (profile = FRONTIER_PROFILE, respond: () => unknown = () => ({ type: "other", evidence: "x" })) => {
  const provider = new FakeProvider("fake", profile, respond);
  const usage = new RecordingUsageSink();
  const gateway = new Gateway({
    provider,
    models: { classify: "fake-small-1" },
    usage,
  });
  return { gateway, provider, usage };
};

describe("deterministic first", () => {
  it("answers without touching the model when the text layer is decisive", async () => {
    const { gateway, provider, usage } = build();
    const outcome = await gateway.runTask(
      classifyDocument,
      input({ textLayer: "EU DECLARATION OF CONFORMITY\nWe declare under our sole responsibility…" }),
    );

    expect(outcome.value.type).toBe("declaration_of_conformity");
    expect(outcome.resolvedWithoutModel).toBe(true);
    expect(provider.calls).toHaveLength(0);
    expect(usage.totalCostUsd).toBe(0);
  });

  it("still records the call, so the saving is measurable rather than invisible", async () => {
    const { gateway, usage } = build();
    await gateway.runTask(classifyDocument, input({ textLayer: "TEST REPORT No. 12345" }));

    expect(usage.entries).toHaveLength(1);
    expect(usage.entries[0]?.resolvedWithoutModel).toBe(true);
    expect(usage.modelCallCount).toBe(0);
  });

  it("escalates to the model rather than guessing when two types match", async () => {
    // A declaration stapled to a test report. Picking the first match would be free and wrong.
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "test_report", evidence: "p1" }));
    const outcome = await gateway.runTask(
      classifyDocument,
      input({ textLayer: "TEST REPORT ... EU DECLARATION OF CONFORMITY ..." }),
    );

    expect(provider.calls).toHaveLength(1);
    expect(outcome.resolvedWithoutModel).toBe(false);
    expect(outcome.value.type).toBe("test_report");
  });

  it("escalates when there is nothing to match on", async () => {
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    await gateway.runTask(classifyDocument, input({ filename: "", textLayer: "" }));
    expect(provider.calls).toHaveLength(1);
  });
});

describe("token discipline", () => {
  it("prefers the text layer over page images", async () => {
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    // Long enough that no single phrase decides it, so it reaches the model.
    await gateway.runTask(classifyDocument, input({ textLayer: "lorem ipsum ".repeat(100) }));

    const parts = provider.calls[0]?.parts ?? [];
    expect(parts.every((p) => p.type === "text")).toBe(true);
  });

  it("truncates a long text layer and says so", async () => {
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    const outcome = await gateway.runTask(classifyDocument, input({ textLayer: "x".repeat(50_000) }));

    const part = provider.calls[0]?.parts[0];
    expect(part?.type === "text" && part.text.length).toBe(4_000);
    expect(outcome.omitted[0]).toMatch(/truncated/);
  });

  it("sends at most two pages when there is no text at all", async () => {
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    const pages = Array.from({ length: 12 }, () => ({ bytes: new Uint8Array([1]), mime: "image/png" }));
    const outcome = await gateway.runTask(classifyDocument, input({ filename: "", firstPages: pages }));

    expect(provider.calls[0]?.parts).toHaveLength(2);
    expect(outcome.omitted[0]).toMatch(/only the first 2 of 12/);
  });

  it("refuses to send a request that exceeds the declared budget", async () => {
    // Spending the money and discovering it on the invoice is the failure being prevented.
    const oversized: TaskDefinition<null, unknown> = {
      ...classifyDocument,
      id: "oversized",
      budget: { maxInputTokens: 10, maxOutputTokens: 10 },
      determinism: { kind: "deterministic-first", attempt: () => undefined, describe: "never resolves, for the test" },
      prepareInput: () => ({ parts: [{ type: "text", text: "y".repeat(10_000) }], omitted: [] }),
    } as unknown as TaskDefinition<null, unknown>;

    const { gateway, provider } = build();
    await expect(gateway.runTask(oversized, null)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(provider.calls).toHaveLength(0);
  });

  it("asks for the batch tier on batchable work when the provider has one", async () => {
    const { gateway, provider } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    await gateway.runTask(classifyDocument, input({ textLayer: "lorem ".repeat(100) }), {
      organisationId: "org_1",
      preferBatch: true,
    });
    expect(provider.calls[0]?.batch).toBe(true);
  });

  it("does not ask for a batch tier the provider does not have", async () => {
    const { gateway, provider } = build(
      { ...SMALL_PROFILE, supportsBatch: false },
      () => ({ type: "other", evidence: "" }),
    );
    await gateway.runTask(classifyDocument, input({ textLayer: "lorem ".repeat(100) }), {
      organisationId: "org_1",
      preferBatch: true,
    });
    expect(provider.calls[0]?.batch).toBeUndefined();
  });
});

describe("cost attribution", () => {
  it("records provider, model, prompt version and organisation on every call", async () => {
    const { gateway, usage } = build(FRONTIER_PROFILE, () => ({ type: "other", evidence: "" }));
    await gateway.runTask(classifyDocument, input({ textLayer: "lorem ".repeat(100) }), {
      organisationId: "org_42",
    });

    const entry = usage.entries[0];
    expect(entry?.organisationId).toBe("org_42");
    expect(entry?.providerId).toBe("fake");
    expect(entry?.promptVersion).toBe(classifyDocument.promptVersion);
    expect(entry?.costUsd).toBeGreaterThan(0);
  });
});

describe("configuration errors", () => {
  it("refuses a task whose role has no configured model", async () => {
    const provider = new FakeProvider("fake", FRONTIER_PROFILE, () => ({}));
    const gateway = new Gateway({ provider, models: {}, usage: new RecordingUsageSink() });
    await expect(
      gateway.runTask(classifyDocument, input({ textLayer: "lorem ".repeat(100) })),
    ).rejects.toThrow(/No model configured for role "classify"/);
  });

  it("tells the caller to render pages rather than silently failing on a PDF", async () => {
    const pdfTask = {
      ...classifyDocument,
      id: "pdf_task",
      determinism: { kind: "deterministic-first" as const, attempt: () => undefined, describe: "never resolves, for the test" },
      prepareInput: () => ({ parts: [{ type: "pdf" as const, bytes: new Uint8Array([1]), pages: 3 }], omitted: [] }),
    };
    const { gateway } = build(SMALL_PROFILE);
    await expect(gateway.runTask(pdfTask, input())).rejects.toBeInstanceOf(NeedsRenderedPagesError);
  });
});

describe("cache economics", () => {
  it("says how many reads a cached prefix needs before it pays", () => {
    // "Cache reads are 10% of input" is only half the arithmetic — the write costs a premium.
    // At 2x input to write and 0.2x to read, caching pays from the first reuse.
    expect(cacheBreakEvenReads(FRONTIER_PROFILE)).toBe(1);
  });

  it("reports caching as never worthwhile when a read costs as much as fresh input", () => {
    const pointless = { ...FRONTIER_PROFILE, costPerMTokCachedInput: FRONTIER_PROFILE.costPerMTokInput };
    expect(cacheBreakEvenReads(pointless)).toBe(Number.POSITIVE_INFINITY);
  });

  it("gets more demanding as the write premium rises", () => {
    const expensive = { ...FRONTIER_PROFILE, costPerMTokCacheWrite: 6 };
    expect(cacheBreakEvenReads(expensive)).toBeGreaterThan(cacheBreakEvenReads(FRONTIER_PROFILE));
  });
});
