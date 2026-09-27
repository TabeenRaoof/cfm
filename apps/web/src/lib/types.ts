/**
 * Row shapes for the tables the app reads (supabase/migrations/). Hand-written for now; replace
 * with `supabase gen types typescript` once the project exists (D-048).
 */

import type { FactValue } from "@cfm/catalog";

export type Role = "owner" | "admin" | "member" | "viewer";

export interface Organisation {
  readonly id: string;
  readonly name: string;
  /** ISO alpha-2, or null when not yet stated — unknown, never assumed. */
  readonly establishment_country: string | null;
  /** Organisation-scope facts. Absent key = unknown; null = "we have none". */
  readonly facts: Readonly<Record<string, FactValue>>;
  readonly target_markets: readonly string[];
}

export interface MyOrganisation {
  readonly role: Role;
  readonly organisation: Organisation;
}

/** `null` is "unknown", not "no" — the catalog's hard rule, carried through the UI. */
export type TriState = boolean | null;

export interface Product {
  readonly id: string;
  readonly organisation_id: string;
  readonly sku: string;
  readonly title: string | null;
  readonly brand: string | null;
  readonly category_code: string | null;
  readonly gtin: string | null;
  readonly has_battery: TriState;
  readonly is_electrical: TriState;
  readonly is_toy: TriState;
  readonly has_packaging: TriState;
  readonly manufacturer_country: string | null;
  readonly facts: Readonly<Record<string, FactValue>>;
}

export const PRODUCT_COLUMNS =
  "id, organisation_id, sku, title, brand, category_code, gtin, has_battery, is_electrical, is_toy, has_packaging, manufacturer_country, facts";

export const ORGANISATION_COLUMNS = "id, name, establishment_country, facts, target_markets";

export const CAN_EDIT_PRODUCTS: readonly Role[] = ["owner", "admin", "member"];
export const CAN_MANAGE: readonly Role[] = ["owner", "admin"];
