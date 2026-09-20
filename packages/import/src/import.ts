/**
 * CSV in, facts out. Entirely deterministic — no model is involved in reading a spreadsheet,
 * and none should be: column matching is a lookup, value coercion is a small set of rules, and
 * both need to give the same answer every time so that a customer who re-uploads the same file
 * gets the same result. See tabeen_AGENTS.md, "The AI never decides what the law requires".
 */

import type { CsvOptions } from "./csv.ts";
import { parseCsv } from "./csv.ts";
import type { ColumnDefinition } from "./mapping.ts";
import { COLUMNS, matchColumn } from "./mapping.ts";
import type { FactValue } from "./values.ts";

export type FactBag = Readonly<Record<string, FactValue | undefined>>;

export interface RowWarning {
  readonly row: number;
  readonly column: string;
  readonly message: string;
}

export interface ImportedProduct {
  /** 1-based, counting the header as row 1, so it matches what the seller sees in Excel. */
  readonly row: number;
  readonly sku: string | null;
  readonly title: string | null;
  readonly facts: FactBag;
}

export interface ImportResult {
  readonly products: readonly ImportedProduct[];
  /** Headers we understood, and the fact each one fills. */
  readonly mapped: readonly { readonly header: string; readonly factPath: string; readonly label: string }[];
  /** Headers we did not understand. Shown to the seller — silence here looks like data loss. */
  readonly unmapped: readonly string[];
  /**
   * Facts the catalog can ask about that no column supplied. This is the single most useful
   * output of an import: it is the difference between "your SKUs are fine" and "we cannot tell,
   * and here is the column you are missing".
   */
  readonly absentFacts: readonly { readonly factPath: string; readonly label: string }[];
  readonly warnings: readonly RowWarning[];
  readonly duplicateSkus: readonly string[];
}

export function importProducts(csvText: string, options: CsvOptions): ImportResult {
  const { headers, rows } = parseCsv(csvText, options);

  const columnFor = new Map<number, { definition: ColumnDefinition; header: string }>();
  const mapped: { header: string; factPath: string; label: string }[] = [];
  const unmapped: string[] = [];

  headers.forEach((header, index) => {
    if (header === "") return;
    const definition = matchColumn(header);
    if (!definition) {
      unmapped.push(header);
      return;
    }
    // First column wins. A sheet with both "Country" and "Country of Origin" should not have
    // the later one silently overwrite the earlier; the duplicate is reported as unmapped.
    if ([...columnFor.values()].some((c) => c.definition === definition)) {
      unmapped.push(header);
      return;
    }
    columnFor.set(index, { definition, header });
    mapped.push({ header, factPath: definition.factPath, label: definition.label });
  });

  const warnings: RowWarning[] = [];
  const products: ImportedProduct[] = [];
  const skuCounts = new Map<string, number>();

  rows.forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const facts: Record<string, FactValue | undefined> = {};

    for (const [columnIndex, { definition, header }] of columnFor) {
      const raw = cells[columnIndex] ?? "";
      const { value, warning } = definition.coerce(raw);

      // Only a decided value is recorded. Writing `undefined` explicitly would be harmless
      // today but invites a later `Object.keys` check to treat the key's presence as knowledge.
      if (value !== undefined) facts[definition.factPath] = value;
      if (warning) warnings.push({ row: rowNumber, column: header, message: warning });
    }

    const sku = typeof facts["product.sku"] === "string" ? facts["product.sku"] : null;
    const title = typeof facts["product.title"] === "string" ? facts["product.title"] : null;
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);

    if (isBlankRow(cells)) return;
    products.push({ row: rowNumber, sku, title, facts });
  });

  const suppliedFactPaths = new Set(mapped.map((m) => m.factPath));

  return {
    products,
    mapped,
    unmapped,
    absentFacts: COLUMNS.filter((c) => !suppliedFactPaths.has(c.factPath)).map((c) => ({
      factPath: c.factPath,
      label: c.label,
    })),
    warnings,
    duplicateSkus: [...skuCounts.entries()].filter(([, n]) => n > 1).map(([sku]) => sku).sort(),
  };
}

function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((c) => c.trim() === "");
}
