/**
 * Rules asserted over every registered task, so that task number two cannot quietly skip them.
 */

import { describe, expect, it } from "vitest";
import { TASKS } from "../src/registry.ts";

describe("every AI task", () => {
  it("there is at least one, or this file proves nothing", () => {
    expect(TASKS.length).toBeGreaterThan(0);
  });

  it.each(TASKS.map((t) => [t.id, t] as const))(
    "%s declares how it avoids the model, or why it cannot",
    (_id, task) => {
      if (task.determinism.kind === "deterministic-first") {
        expect(typeof task.determinism.attempt).toBe("function");
        expect(task.determinism.describe.length).toBeGreaterThan(20);
      } else {
        // "It's hard" is not a reason. A short string here is a review failure.
        expect(task.determinism.because.length).toBeGreaterThan(40);
      }
    },
  );

  it.each(TASKS.map((t) => [t.id, t] as const))("%s declares a token budget", (_id, task) => {
    expect(task.budget.maxInputTokens).toBeGreaterThan(0);
    expect(task.budget.maxOutputTokens).toBeGreaterThan(0);
    // A classification that is allowed 100k input tokens has no budget, it has a formality.
    expect(task.budget.maxInputTokens).toBeLessThanOrEqual(200_000);
  });

  it.each(TASKS.map((t) => [t.id, t] as const))("%s names a role, not a model", (_id, task) => {
    expect(task.modelRole).not.toMatch(/claude|gpt|gemini|haiku|sonnet|opus|qwen|llama/i);
  });

  it.each(TASKS.map((t) => [t.id, t] as const))("%s has a versioned prompt", (_id, task) => {
    expect(task.promptVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it.each(TASKS.map((t) => [t.id, t] as const))("%s uses a closed schema", (_id, task) => {
    // An open schema lets a provider return extra fields that silently differ between vendors.
    // Called with a plausible input, since a schema may narrow itself against one.
    expect(task.schema(task.sampleInput)["additionalProperties"]).toBe(false);
  });
});
