/**
 * Rendering a channel export.
 *
 * THE HARD RULE AT THE EXPORT BOUNDARY. This is the last place the product's data passes
 * through before it reaches someone else's system, and it is the easiest place to lose the
 * distinction the whole product rests on: a fact we were never told must leave as an empty
 * cell, never as "no", "false" or "N/A". A marketplace reading "no" where we meant "we don't
 * know" is the false green again, escaped into a system we do not control and cannot correct.
 */

import { writeCsv } from "./csv-write.ts";
import type { ChannelTemplate, ExportRow, TemplateColumn } from "./template.ts";
import { describeStatus, UnverifiedTemplateError } from "./template.ts";

export interface ExportOptions {
  /** Produce a file from a template nobody has checked. Labelled in the result. */
  readonly allowUnverified?: boolean;
  readonly delimiter?: string;
}

export interface ExportResult {
  readonly csv: string;
  readonly templateId: string;
  readonly verified: boolean;
  readonly rows: number;
  /** Columns the template asks for that nothing we hold can fill. Shown to the seller. */
  readonly unfilledColumns: readonly string[];
  /** Cells left blank because the answer is unknown, per SKU. The gap list, restated. */
  readonly blankBecauseUnknown: number;
  readonly warnings: readonly string[];
}

export function renderChannelExport(
  template: ChannelTemplate,
  rows: readonly ExportRow[],
  options: ExportOptions = {},
): ExportResult {
  if (!template.verified && options.allowUnverified !== true) {
    throw new UnverifiedTemplateError(template.id);
  }

  let blankBecauseUnknown = 0;
  const filled = new Set<string>();

  const body = rows.map((row) =>
    template.columns.map((column) => {
      const value = cellFor(column, row);
      if (value !== "") filled.add(column.header);
      else if (column.source.kind === "fact" && row.facts[column.source.path] === undefined) {
        blankBecauseUnknown += 1;
      }
      return value;
    }),
  );

  const warnings: string[] = [];
  if (!template.verified) {
    warnings.push(
      `Template "${template.id}" has not been checked against ${template.label}'s real template. ` +
        `The column headers may be wrong and the upload may be rejected.`,
    );
  }
  if (blankBecauseUnknown > 0) {
    warnings.push(
      `${blankBecauseUnknown} cell(s) left blank because the answer is not known. They are blank ` +
        `rather than "no" on purpose — supplying the missing information will fill them.`,
    );
  }

  return {
    csv: writeCsv(
      template.columns.map((c) => c.header),
      body,
      { ...(options.delimiter ? { delimiter: options.delimiter } : {}) },
    ),
    templateId: template.id,
    verified: template.verified,
    rows: rows.length,
    unfilledColumns: template.columns.map((c) => c.header).filter((h) => !filled.has(h)),
    blankBecauseUnknown,
    warnings,
  };
}

function cellFor(column: TemplateColumn, row: ExportRow): string {
  switch (column.source.kind) {
    case "sku":
      return row.sku;
    case "title":
      return row.title ?? "";
    case "market":
      return row.assessment.market;
    case "constant":
      return column.source.value;
    case "blank":
      return "";
    case "requirement_status": {
      const id = column.source.requirement_id;
      return describeStatus(row.assessment.assessments.find((a) => a.requirement_id === id));
    }
    case "fact": {
      const value = row.facts[column.source.path];
      // undefined -> we were never told. null -> told there is none. Both leave the cell empty,
      // because neither is a value the channel should receive, but only the first is a gap.
      if (value === undefined || value === null) return "";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      return String(value);
    }
  }
}
