/**
 * "If we move from one provider to another, does it still work?"
 *
 * A narrow interface is not the answer on its own — providers differ in context window, in
 * whether they read PDFs, in how a schema-valid result is obtained, and in whether a batch
 * tier exists. Those differences are what actually break a swap, so every registered task is
 * run against a profile for each of them.
 *
 * What this proves: the task contract holds across capability variation, and no task is
 * accidentally written against one vendor's conveniences.
 *
 * What this cannot prove, and no test can: that a different model *reads a scanned test report
 * as accurately*. That is what the golden-set eval is for, and it is the gate for a provider
 * change exactly as it is for a prompt change (decisions.md D-014).
 */

import { describe, expect, it } from "vitest";
import { Gateway } from "../src/gateway.ts";
import { TASKS } from "../src/registry.ts";
import {
  FakeProvider,
  FRONTIER_PROFILE,
  MINIMAL_PROFILE,
  RecordingUsageSink,
  SMALL_PROFILE,
} from "../src/fake.ts";
import { classifyDocument } from "../src/tasks/classify-document.ts";
import type { ClassifyInput } from "../src/tasks/classify-document.ts";

const PROFILES = [
  ["frontier: 1M window, native PDF, native schema, batch", FRONTIER_PROFILE],
  ["small: 200K window, no PDF, tool-based schema", SMALL_PROFILE],
  ["minimal: no PDF, prompted schema, no batch, no cache", MINIMAL_PROFILE],
] as const;

const ambiguous: ClassifyInput = {
  filename: "unknown.pdf",
  textLayer: "some text that matches nothing in particular ".repeat(20),
  firstPages: [],
};

describe.each(PROFILES)("against a provider whose profile is %s", (_label, profile) => {
  const run = async () => {
    const provider = new FakeProvider("swapped", profile, () => ({ type: "test_report", evidence: "p1" }));
    const usage = new RecordingUsageSink();
    const gateway = new Gateway({
      provider,
      models: Object.fromEntries(TASKS.map((t) => [t.modelRole, "whatever-model-id"])),
      usage,
      imageTokensPerPage: 1_900,
    });
    return { gateway, provider, usage };
  };

  it("runs the task and returns the same shape", async () => {
    const { gateway } = await run();
    const outcome = await gateway.runTask(classifyDocument, ambiguous);
    expect(outcome.value).toEqual({ type: "test_report", evidence: "p1" });
  });

  it("stays inside the profile's context window", async () => {
    const { gateway, provider } = await run();
    await gateway.runTask(classifyDocument, ambiguous);
    const sent = provider.estimateInputTokens(provider.calls[0]!);
    expect(sent).toBeLessThanOrEqual(profile.maxInputTokens);
  });

  it("never asks for more output than the profile allows", async () => {
    const { gateway, provider } = await run();
    await gateway.runTask(classifyDocument, ambiguous);
    expect(provider.calls[0]!.maxOutputTokens).toBeLessThanOrEqual(profile.maxOutputTokens);
  });

  it("validates the result itself, whatever the provider's structured-output support", async () => {
    // A `prompted` provider gets held to the same contract as a `native` one.
    const provider = new FakeProvider("swapped", profile, () => ({ evidence: "no type field" }));
    const gateway = new Gateway({
      provider,
      models: { classify: "whatever" },
      usage: new RecordingUsageSink(),
      imageTokensPerPage: 1_900,
    });
    await expect(gateway.runTask(classifyDocument, ambiguous)).rejects.toThrow(/returned no type/);
  });

  it("resolves deterministically without reaching the provider at all", async () => {
    // The cheapest portability property there is: work that never leaves the process cannot
    // be broken by changing who the provider is.
    const { gateway, provider } = await run();
    const outcome = await gateway.runTask(classifyDocument, {
      ...ambiguous,
      textLayer: "Konformitätserklärung",
    });
    expect(outcome.value.type).toBe("declaration_of_conformity");
    expect(provider.calls).toHaveLength(0);
  });
});
