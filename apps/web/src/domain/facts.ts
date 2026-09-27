/**
 * Translating between database rows and the catalog's fact bag (packages/catalog/src/facts.ts).
 *
 * The catalog's central distinction — ABSENT key = unknown, null = "we know there is none" — has
 * to survive two trips: CSV → database (toImportRows) and database → evaluator (subjectFacts).
 * Typed nullable columns can only say "known value" or NULL, so NULL in a typed column always
 * reads as unknown. The importer's rare "none" for a typed fact therefore collapses to unknown:
 * the conservative direction, since unknown is never market-ready and never "not applicable".
 * Every other fact rides in a jsonb bag that keeps the distinction exactly (migration 0002).
 */

import type { Catalog, Condition, FactBag, FactValue } from "@cfm/catalog";
import type { ImportResult } from "@cfm/import";
import { COLUMNS } from "@cfm/import";

/** Fact paths held in typed product columns — the only source of truth for these paths. */
export const TYPED_PRODUCT_FACTS = {
  "product.title": { column: "title", kind: "text" },
  "product.brand": { column: "brand", kind: "text" },
  "product.category_code": { column: "category_code", kind: "text" },
  "product.gtin": { column: "gtin", kind: "text" },
  "product.has_battery": { column: "has_battery", kind: "boolean" },
  "product.is_electrical": { column: "is_electrical", kind: "boolean" },
  "product.is_toy": { column: "is_toy", kind: "boolean" },
  "product.has_packaging": { column: "has_packaging", kind: "boolean" },
  "manufacturer.country": { column: "manufacturer_country", kind: "text" },
} as const;

type TypedPath = keyof typeof TYPED_PRODUCT_FACTS;
type TypedColumn = (typeof TYPED_PRODUCT_FACTS)[TypedPath]["column"];

/** The prefixes each fact bag may hold — must match the CHECK constraints in migration 0002. */
export const PRODUCT_FACT_PREFIXES = ["product", "manufacturer", "rp"] as const;
export const ORGANISATION_FACT_PREFIXES = ["organisation", "packaging"] as const;

export interface ProductRow {
  readonly sku: string;
  readonly title: string | null;
  readonly brand: string | null;
  readonly category_code: string | null;
  readonly gtin: string | null;
  readonly has_battery: boolean | null;
  readonly is_electrical: boolean | null;
  readonly is_toy: boolean | null;
  readonly has_packaging: boolean | null;
  readonly manufacturer_country: string | null;
  readonly facts: Readonly<Record<string, FactValue>>;
}

export interface OrganisationRow {
  readonly establishment_country: string | null;
  readonly facts: Readonly<Record<string, FactValue>>;
}

export type ImportRow = { readonly sku: string; readonly facts: Record<string, FactValue> } & Partial<
  Record<TypedColumn, string | boolean>
>;

export interface PreparedImport {
  readonly rows: readonly ImportRow[];
  /** Spreadsheet row numbers with no SKU — nothing to key them on, so they are not imported. */
  readonly skippedRows: readonly number[];
  /** Fact paths outside the product scope. The importer shouldn't produce any; reported, not sent. */
  readonly droppedFacts: readonly string[];
}

const hasPrefix = (path: string, prefixes: readonly string[]) => prefixes.includes(path.split(".")[0] ?? "");

/** CSV import result → rows for `public.import_products`. Unknown stays absent; nothing is defaulted. */
export function toImportRows(imported: ImportResult): PreparedImport {
  const rows: ImportRow[] = [];
  const skippedRows: number[] = [];
  const droppedFacts = new Set<string>();

  for (const product of imported.products) {
    if (!product.sku) {
      skippedRows.push(product.row);
      continue;
    }
    const typed: Partial<Record<TypedColumn, string | boolean>> = {};
    const facts: Record<string, FactValue> = {};

    for (const [path, value] of Object.entries(product.facts)) {
      if (value === undefined || path === "product.sku") continue;
      const typedTarget = (TYPED_PRODUCT_FACTS as Record<string, { column: TypedColumn; kind: string }>)[path];
      if (typedTarget) {
        // A typed column can't hold "none"; leaving it out keeps it unknown (see header).
        if (value === null) continue;
        if (typedTarget.kind === "boolean" && typeof value === "boolean") typed[typedTarget.column] = value;
        if (typedTarget.kind === "text" && typeof value === "string") typed[typedTarget.column] = value;
        continue;
      }
      if (!hasPrefix(path, PRODUCT_FACT_PREFIXES)) {
        droppedFacts.add(path);
        continue;
      }
      facts[path] = value;
    }
    rows.push({ sku: product.sku, ...typed, facts });
  }

  return { rows, skippedRows, droppedFacts: [...droppedFacts].sort() };
}

/** Database product row → the facts it contributes. NULL typed columns contribute nothing (unknown). */
export function productFacts(product: ProductRow): FactBag {
  const bag: Record<string, FactValue> = { "product.sku": product.sku };
  for (const [path, { column }] of Object.entries(TYPED_PRODUCT_FACTS)) {
    const value = product[column as TypedColumn];
    if (value !== null) bag[path] = value;
  }
  return { ...bag, ...product.facts };
}

export function organisationFacts(organisation: OrganisationRow): FactBag {
  const bag: Record<string, FactValue> = { ...organisation.facts };
  if (organisation.establishment_country !== null) {
    bag["organisation.establishment_country"] = organisation.establishment_country;
  }
  return bag;
}

/** Everything the evaluator knows about one product sold by one organisation. */
export function subjectFacts(organisation: OrganisationRow, product: ProductRow): FactBag {
  return { ...organisationFacts(organisation), ...productFacts(product) };
}

// ---------------------------------------------------------------------------------------------
// Which facts the catalog can ask about, and what kind of value each one is. Derived from the
// catalog itself, so the organisation-details form can't drift from the requirements it serves.
// ---------------------------------------------------------------------------------------------

export type FactKind = "boolean" | "number" | "text";

export interface FactField {
  readonly path: string;
  readonly label: string;
  readonly kind: FactKind;
}

function collectConditionPaths(condition: Condition, into: Map<string, FactKind>): void {
  for (const [key, value] of Object.entries(condition)) {
    if (key === "all" || key === "any") {
      for (const child of value as readonly Condition[]) collectConditionPaths(child, into);
    } else if (key === "not") {
      collectConditionPaths(value as Condition, into);
    } else if (key !== "always") {
      let kind: FactKind = "text";
      if (typeof value === "boolean") kind = "boolean";
      else if (value !== null && typeof value === "object" && ["gt", "gte", "lt", "lte"].some((c) => c in value)) kind = "number";
      if (!into.has(key) || into.get(key) === "text") into.set(key, kind);
    }
  }
}

const IMPORT_LABELS: ReadonlyMap<string, string> = new Map(COLUMNS.map((c) => [c.factPath, c.label]));

export function factLabel(path: string, catalog: Catalog): string {
  for (const requirement of catalog.requirements) {
    const match = requirement.required_data.find((d) => d.key === path);
    if (match) return match.label;
  }
  const imported = IMPORT_LABELS.get(path);
  if (imported) return imported;
  const [, name = path] = path.split(".");
  const words = name.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Every fact in the given scope the catalog reads, with its kind. Derived facts excluded. */
export function factFields(catalog: Catalog, prefixes: readonly string[], reserved: readonly string[] = []): FactField[] {
  const kinds = new Map<string, FactKind>();
  for (const requirement of catalog.requirements) {
    collectConditionPaths(requirement.applies_when as Condition, kinds);
    for (const data of requirement.required_data) if (!kinds.has(data.key)) kinds.set(data.key, "text");
  }
  const DERIVED = ["organisation.established_in_eu", "organisation.established_in_market", "manufacturer.country_in_eu"];
  return [...kinds.entries()]
    .filter(([path]) => hasPrefix(path, prefixes) && !DERIVED.includes(path) && !reserved.includes(path))
    .map(([path, kind]) => ({ path, kind, label: factLabel(path, catalog) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
