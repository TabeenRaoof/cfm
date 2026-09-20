/**
 * Building the catalog and deciding what is fit to show a customer.
 *
 * Deliberately free of Node built-ins: this module runs in the browser, in the public scanner.
 * Reading requirement files off a disk lives in `node.ts`, which the browser bundle never
 * imports. `test/browser-safe.test.ts` enforces the split — without it, one convenient
 * `node:fs` import silently makes the whole evaluator unbundleable.
 *
 * Two filters run here and they do different jobs:
 *   - the publish gate drops drafts (decisions.md D-008) — editorial
 *   - the effective-date window drops requirements not yet in force, or withdrawn — legal
 */

import type { Requirement } from "./types.ts";
import type { ValidationIssue } from "./validate.ts";
import { validateRequirement } from "./validate.ts";

export interface Catalog {
  readonly version: string;
  readonly requirements: readonly Requirement[];
}

export interface BuildResult {
  readonly catalog: Catalog;
  readonly issues: readonly ValidationIssue[];
  /** Requirements that validated but were withheld because they are still drafts. */
  readonly withheldDrafts: readonly string[];
}

export interface BuildOptions {
  readonly version: string;
  /**
   * Drafts are for the authoring UI and the test suite only. Nothing customer-facing may pass
   * true here, which is why it has no default — a caller has to say the word.
   */
  readonly includeDrafts: boolean;
}

export function buildCatalog(
  entries: readonly { readonly file: string; readonly data: unknown }[],
  options: BuildOptions,
): BuildResult {
  const issues: ValidationIssue[] = [];
  const requirements: Requirement[] = [];
  const withheldDrafts: string[] = [];
  const seen = new Map<string, string>();

  for (const { file, data } of entries) {
    const fileIssues = validateRequirement(data, file);
    if (fileIssues.length > 0) {
      issues.push(...fileIssues);
      continue;
    }
    const requirement = data as Requirement;

    const firstSeenIn = seen.get(requirement.id);
    if (firstSeenIn) {
      issues.push({
        file,
        path: "id",
        message: `Duplicate requirement id "${requirement.id}", already defined in ${firstSeenIn}.`,
      });
      continue;
    }
    seen.set(requirement.id, file);

    if (requirement.state === "draft" && !options.includeDrafts) {
      withheldDrafts.push(requirement.id);
      continue;
    }
    requirements.push(requirement);
  }

  return {
    catalog: { version: options.version, requirements },
    issues,
    withheldDrafts,
  };
}

/** In force on the given date. Lexicographic compare is safe for YYYY-MM-DD. */
export function inForce(requirement: Requirement, asOf: string): boolean {
  if (requirement.effective_from > asOf) return false;
  if (requirement.effective_to !== null && requirement.effective_to < asOf) return false;
  return true;
}
