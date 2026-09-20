/**
 * Channel export templates.
 *
 * A marketplace's bulk-upload template is *their* artefact, not ours: the exact column headers
 * change without notice and cannot be derived from anything we hold. `02-` §8.1 says to keep
 * them as versioned fixtures and re-check monthly, so that is what a template is — a data file,
 * not code.
 *
 * This turns "we cannot see Amazon's real template without a Seller Central account" from a
 * blocker into a configuration step, and it follows the catalog's pattern exactly: a template is
 * `verified: false` until a human has put the real thing side by side with it, and an
 * unverified template cannot be exported without saying so explicitly.
 */

import type { Assessment, ProductAssessment } from "@cfm/catalog";

export type ColumnSource =
  | { readonly kind: "sku" }
  | { readonly kind: "title" }
  | { readonly kind: "market" }
  /** A value from the product's facts, e.g. "rp.name". Unknown exports as blank, never as "no". */
  | { readonly kind: "fact"; readonly path: string }
  | { readonly kind: "constant"; readonly value: string }
  /** The status of one requirement, in words a human reads rather than our internal enum. */
  | { readonly kind: "requirement_status"; readonly requirement_id: string }
  /** Present in the channel's template, but nothing we hold fills it. */
  | { readonly kind: "blank" };

export interface TemplateColumn {
  /** Exact header text the channel expects. Copied from their template, never invented. */
  readonly header: string;
  readonly source: ColumnSource;
  readonly note?: string;
}

export interface ChannelTemplate {
  readonly id: string;
  readonly label: string;
  /** The channel's own version or date for this template, if it publishes one. */
  readonly template_version: string;
  /**
   * True only once a human has compared this against the real template downloaded from the
   * channel. Until then an export is a guess dressed as a file, which is worse than no export:
   * a seller uploads it, it is rejected, and they conclude the tool does not work.
   */
  readonly verified: boolean;
  readonly source: { readonly title: string; readonly url: string; readonly retrieved_at: string | null } | null;
  readonly columns: readonly TemplateColumn[];
  readonly notes: readonly string[];
}

export class UnverifiedTemplateError extends Error {
  readonly templateId: string;

  constructor(templateId: string) {
    super(
      `Template "${templateId}" has not been checked against the channel's real template. ` +
        `Download the current one from the channel, compare the column headers, set ` +
        `verified: true — or pass { allowUnverified: true } to produce a clearly-labelled draft.`,
    );
    this.name = "UnverifiedTemplateError";
    this.templateId = templateId;
  }
}

export interface ExportRow {
  readonly sku: string;
  readonly title: string | null;
  readonly facts: Readonly<Record<string, string | number | boolean | null | undefined>>;
  readonly assessment: ProductAssessment;
}

/**
 * How an assessment status reads in someone else's spreadsheet.
 *
 * `unknown` is the one that matters. It must never render as anything a reader could mistake
 * for a negative determination — "not applicable" would be a lie, and an empty cell would be
 * read as "nothing to do". It says what it is.
 */
export function describeStatus(assessment: Assessment | undefined): string {
  if (!assessment) return "";
  switch (assessment.status) {
    case "met":
      return "Evidence on file";
    case "na":
      return "Not applicable";
    case "expired":
      return "Evidence expired";
    case "pending":
      return "Requested from supplier";
    case "partial":
      return "Partly evidenced";
    case "missing":
      return "Outstanding";
    case "unknown":
      return "Cannot determine - information needed";
  }
}
