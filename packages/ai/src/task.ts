/**
 * Task definitions: the only way to call a model in this codebase.
 *
 * Two of the project's standing rules are enforced here structurally rather than by review,
 * because a rule that lives only in prose gets traded away under deadline (playbook Lesson 19)
 * and a checklist does not verify itself (Lesson 21).
 *
 * RULE 1 — DETERMINISTIC FIRST.
 * Every task must declare either a deterministic attempt that runs *before* the model, or an
 * explicit written reason why no deterministic path exists. `runTask` always runs the
 * deterministic attempt first and only reaches the model when it returns `undefined`. There is
 * no code path that calls a model without passing this gate, and a task registered without the
 * declaration fails a test rather than a review.
 *
 * RULE 2 — A DECLARED TOKEN BUDGET.
 * Every task states the most input and output tokens it may spend. `prepareInput` is the task's
 * chance to send less — the text layer instead of page images, two pages instead of twelve, the
 * fields still missing instead of the whole record. The gateway refuses to send a request that
 * exceeds the budget rather than quietly spending the money, because a silent overspend is only
 * discovered on the invoice.
 */

import type { ContentPart } from "./provider.ts";

export type Determinism<Input, Output> =
  | {
      readonly kind: "deterministic-first";
      /**
       * Cheap, exact attempt. Returns a result when it is confident, `undefined` to escalate.
       * Must never guess: a wrong free answer is worse than a right paid one.
       */
      readonly attempt: (input: Input) => Output | undefined;
      readonly describe: string;
    }
  | {
      readonly kind: "no-deterministic-path";
      /** Written, specific, and reviewed. "It's hard" is not a reason. */
      readonly because: string;
    };

export interface TokenBudget {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
}

export interface PreparedInput {
  readonly parts: readonly ContentPart[];
  /** What was deliberately left out, and why. Surfaced in the admin cost view. */
  readonly omitted: readonly string[];
}

export interface TaskDefinition<Input, Output> {
  readonly id: string;
  /** Bumped on any prompt change; recorded against every extraction for reproducibility. */
  readonly promptVersion: string;
  /** A configuration key such as "classify" or "extract", never a model id. */
  readonly modelRole: string;
  readonly system: string;
  /**
   * The JSON Schema the model must satisfy. A function of the input, not a constant, because
   * the useful tasks narrow it: extraction asks only for the fields a deterministic pass could
   * not already answer, so the schema shrinks with every regex that hits. Constant schemas pass
   * a function that ignores its argument.
   */
  readonly schema: (input: Input) => Readonly<Record<string, unknown>>;
  readonly budget: TokenBudget;
  readonly determinism: Determinism<Input, Output>;
  /** Send the least that can answer the question. */
  readonly prepareInput: (input: Input) => PreparedInput;
  readonly parse: (raw: unknown) => Output;
  /** Non-urgent work should say so; batch tiers are roughly half price. */
  readonly batchable: boolean;
  /**
   * A representative input. Exists so the registry-wide rules can actually exercise a task —
   * a schema that varies by input cannot be checked without one, and a rule that cannot be
   * checked is a rule that will be broken by task number three.
   */
  readonly sampleInput: Input;
}

export class BudgetExceededError extends Error {
  readonly taskId: string;
  readonly estimated: number;
  readonly budget: number;

  constructor(taskId: string, estimated: number, budget: number) {
    super(
      `Task "${taskId}" would send about ${estimated} input tokens against a declared budget of ` +
        `${budget}. Reduce the input in prepareInput, or raise the budget deliberately.`,
    );
    this.name = "BudgetExceededError";
    this.taskId = taskId;
    this.estimated = estimated;
    this.budget = budget;
  }
}
