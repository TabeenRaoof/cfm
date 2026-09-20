/**
 * The neutral export: everything we hold about each SKU, in our own schema.
 *
 * Every channel template is a guess about someone else's file format until a human checks it.
 * This one cannot be wrong, because it is not pretending to be anyone else's — which makes it
 * the export that always works, the one a seller can map themselves, and the one to reach for
 * when a marketplace changes its template on a Tuesday.
 */

import { writeCsv } from "./csv-write.ts";
import type { ExportRow } from "./template.ts";
import { describeStatus } from "./template.ts";

export interface FullExportResult {
  readonly csv: string;
  readonly rows: number;
  readonly requirementColumns: readonly string[];
}

export function renderFullExport(rows: readonly ExportRow[]): FullExportResult {
  // Column set is the union across rows, so a catalog difference between markets does not
  // silently drop a column that only some SKUs have.
  const requirementIds = [
    ...new Set(rows.flatMap((r) => r.assessment.assessments.map((a) => a.requirement_id))),
  ].sort();

  const headers = [
    "SKU",
    "Title",
    "Market",
    "Channel",
    "Assessed on",
    "Catalog version",
    "Market ready",
    "Information needed",
    ...requirementIds,
  ];

  const body = rows.map((row) => [
    row.sku,
    row.title ?? "",
    row.assessment.market,
    row.assessment.channel ?? "",
    row.assessment.assessed_at,
    row.assessment.catalog_version,
    // Never "Yes"/"No" alone: the reason a SKU is not ready is the useful half.
    row.assessment.market_ready ? "Yes" : "No",
    row.assessment.questions.join("; "),
    ...requirementIds.map((id) =>
      describeStatus(row.assessment.assessments.find((a) => a.requirement_id === id)),
    ),
  ]);

  return { csv: writeCsv(headers, body), rows: rows.length, requirementColumns: requirementIds };
}
