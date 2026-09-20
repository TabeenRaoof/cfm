/**
 * The gateway. Every model call in the product goes through `runTask`, and nothing else in the
 * codebase is allowed to hold a provider.
 *
 * It does four jobs, in this order:
 *   1. Runs the task's deterministic attempt, and returns without spending anything if it works.
 *   2. Adapts the request to what the chosen provider actually supports.
 *   3. Refuses to exceed the task's declared token budget.
 *   4. Records model, provider, prompt version, tokens and cost against the caller's
 *      organisation, so cost per customer is a measured number from the first call rather than
 *      something reconstructed from an invoice later (playbook addendum §B).
 */

import type { GenerationRequest, ModelCapabilities, Provider } from "./provider.ts";
import { estimateTokens } from "./provider.ts";
import type { PreparedInput, TaskDefinition } from "./task.ts";
import { BudgetExceededError } from "./task.ts";

export interface UsageRecord {
  readonly taskId: string;
  readonly promptVersion: string;
  readonly providerId: string;
  readonly model: string;
  readonly organisationId: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  /** True when the deterministic path answered and no request was sent. */
  readonly resolvedWithoutModel: boolean;
}

export interface UsageSink {
  record(entry: UsageRecord): void;
}

export interface GatewayConfig {
  readonly provider: Provider;
  /** Role to concrete model id. Configuration, so a swap never touches feature code. */
  readonly models: Readonly<Record<string, string>>;
  readonly usage: UsageSink;
  /** Tokens charged per rendered page image; differs by provider and page size. */
  readonly imageTokensPerPage: number;
}

export interface RunContext {
  readonly organisationId: string | null;
  /** Ask for the batch tier where the task allows it. */
  readonly preferBatch?: boolean;
}

export interface TaskOutcome<Output> {
  readonly value: Output;
  readonly resolvedWithoutModel: boolean;
  readonly usage: UsageRecord | null;
  readonly omitted: readonly string[];
}

export class Gateway {
  private readonly config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async runTask<Input, Output>(
    task: TaskDefinition<Input, Output>,
    input: Input,
    context: RunContext = { organisationId: null },
  ): Promise<TaskOutcome<Output>> {
    // 1. Deterministic first, always. This is the gate, not a suggestion.
    if (task.determinism.kind === "deterministic-first") {
      const answer = task.determinism.attempt(input);
      if (answer !== undefined) {
        const record: UsageRecord = {
          taskId: task.id,
          promptVersion: task.promptVersion,
          providerId: "none",
          model: "none",
          organisationId: context.organisationId,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          resolvedWithoutModel: true,
        };
        this.config.usage.record(record);
        return { value: answer, resolvedWithoutModel: true, usage: record, omitted: [] };
      }
    }

    const model = this.config.models[task.modelRole];
    if (!model) {
      throw new Error(
        `No model configured for role "${task.modelRole}". Roles are configuration; add it ` +
          `rather than naming a model in the task.`,
      );
    }

    const capabilities = this.config.provider.capabilities(model);
    const prepared = adaptToCapabilities(task.prepareInput(input), capabilities);

    // 3. Budget, checked before anything is sent.
    const estimated = estimateTokens(prepared.parts, this.config.imageTokensPerPage);
    if (estimated > task.budget.maxInputTokens) {
      throw new BudgetExceededError(task.id, estimated, task.budget.maxInputTokens);
    }
    if (estimated > capabilities.maxInputTokens) {
      throw new BudgetExceededError(task.id, estimated, capabilities.maxInputTokens);
    }

    const request: GenerationRequest = {
      model,
      system: task.system,
      parts: prepared.parts,
      schema: task.schema(input),
      maxOutputTokens: Math.min(task.budget.maxOutputTokens, capabilities.maxOutputTokens),
      ...(task.batchable && context.preferBatch && capabilities.supportsBatch ? { batch: true } : {}),
    };

    const result = await this.config.provider.generate(request);

    // The gateway validates the shape regardless of how the provider produced it, so a
    // `prompted` provider is held to the same contract as a `native` one.
    const value = task.parse(result.value);

    const record: UsageRecord = {
      taskId: task.id,
      promptVersion: task.promptVersion,
      providerId: result.providerId,
      model: result.model,
      organisationId: context.organisationId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      resolvedWithoutModel: false,
    };
    this.config.usage.record(record);

    return { value, resolvedWithoutModel: false, usage: record, omitted: prepared.omitted };
  }
}

/**
 * 2. Capability adaptation — the part that makes a provider swap a config change.
 *
 * A task asks for what it wants; the provider gets what it can take. A PDF sent to a model
 * that cannot read PDFs is not an error the caller should have to handle, it is a rendering
 * step — and the task should not have to know which provider is configured in order to decide.
 */
export function adaptToCapabilities(
  prepared: PreparedInput,
  capabilities: ModelCapabilities,
): PreparedInput {
  const parts = [...prepared.parts];
  const omitted = [...prepared.omitted];

  const pdfIndex = parts.findIndex((p) => p.type === "pdf");
  if (pdfIndex !== -1 && !capabilities.acceptsPdf) {
    if (!capabilities.acceptsImages) {
      throw new Error(
        "The configured model accepts neither PDFs nor images. Configure a vision-capable " +
          "model for this role, or add a text-extraction step upstream.",
      );
    }
    // Deliberately explicit rather than silent: the caller has to have rendered the pages,
    // because rendering belongs to @cfm/documents and not to the AI gateway.
    throw new NeedsRenderedPagesError();
  }

  return { parts, omitted };
}

export class NeedsRenderedPagesError extends Error {
  constructor() {
    super(
      "The configured provider cannot read PDFs directly; render the pages to images in " +
        "@cfm/documents and pass image parts instead.",
    );
    this.name = "NeedsRenderedPagesError";
  }
}
