/**
 * Row shapes for the tables the app reads (supabase/migrations/*_tenancy.sql). Hand-written for
 * now; replace with `supabase gen types typescript` once the project exists (D-048).
 */

export type Role = "owner" | "admin" | "member" | "viewer";

export interface Organisation {
  readonly id: string;
  readonly name: string;
  /** ISO alpha-2, or null when not yet stated — unknown, never assumed. */
  readonly establishment_country: string | null;
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
  readonly has_battery: TriState;
  readonly is_electrical: TriState;
  readonly is_toy: TriState;
  readonly has_packaging: TriState;
  readonly country_of_origin: string | null;
}

export const CAN_EDIT_PRODUCTS: readonly Role[] = ["owner", "admin", "member"];
