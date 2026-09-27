/**
 * CSV import and fact storage (supabase/migrations/*_facts_invitations_import.sql, D-050).
 *
 * The hard rule at the storage boundary: an import can add knowledge and correct it, but a blank
 * cell never erases what was already known, and "we were told there is none" (JSON null) stays
 * distinguishable from "we were not told" (absent key).
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const OWNER = "a0000000-0000-4000-8000-000000000001";
const VIEWER = "a0000000-0000-4000-8000-000000000002";
const OUTSIDER = "b0000000-0000-4000-8000-000000000001";

let db: PGlite;
let acme: string;
let beta: string;

const importRows = (by: string, org: string, rows: unknown[]) =>
  as(db, user(by), (tx) =>
    tx.query<{ inserted: number; updated: number }>("select * from public.import_products($1, $2::jsonb)", [org, JSON.stringify(rows)]),
  { commit: true });

async function product(sku: string) {
  return (await db.query<Record<string, unknown>>(
    "select title, brand, has_battery, is_toy, manufacturer_country, facts from public.product where organisation_id = $1 and sku = $2",
    [acme, sku],
  )).rows[0];
}

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, OWNER, "owner@acme.test");
  await createUser(db, VIEWER, "viewer@acme.test");
  await createUser(db, OUTSIDER, "owner@beta.test");
  acme = await as(db, user(OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Acme Ltd', 'GB') as id")).rows[0]!.id,
  { commit: true });
  beta = await as(db, user(OUTSIDER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Beta GmbH', 'DE') as id")).rows[0]!.id,
  { commit: true });
  await db.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, 'viewer')", [acme, VIEWER]);
});

afterAll(async () => {
  await db.close();
});

describe("import_products", () => {
  it("inserts new products and reports how many", async () => {
    const result = await importRows(OWNER, acme, [
      { sku: "K-1", title: "Kettle", has_battery: false, manufacturer_country: "CN", facts: { "manufacturer.name": "Shenzhen Co", "rp.name": null } },
      { sku: "T-1", title: "Toy robot", is_toy: true },
    ]);
    expect(result.rows[0]).toEqual({ inserted: 2, updated: 0 });
    expect(await product("K-1")).toMatchObject({
      title: "Kettle", has_battery: false, is_toy: null, manufacturer_country: "CN",
      facts: { "manufacturer.name": "Shenzhen Co", "rp.name": null },
    });
  });

  it("a re-import with blanks never erases what was already known", async () => {
    // K-1 again, from a sheet with no title, battery or country columns, and no manufacturer.
    const result = await importRows(OWNER, acme, [{ sku: "K-1", brand: "Acme", facts: {} }]);
    expect(result.rows[0]).toEqual({ inserted: 0, updated: 1 });
    expect(await product("K-1")).toMatchObject({
      title: "Kettle", brand: "Acme", has_battery: false, manufacturer_country: "CN",
      facts: { "manufacturer.name": "Shenzhen Co", "rp.name": null },
    });
  });

  it("a known value in the new sheet corrects the old one", async () => {
    await importRows(OWNER, acme, [{ sku: "K-1", has_battery: true, facts: { "rp.name": "EU Rep GmbH" } }]);
    expect(await product("K-1")).toMatchObject({
      has_battery: true,
      facts: { "manufacturer.name": "Shenzhen Co", "rp.name": "EU Rep GmbH" },
    });
  });

  it("keeps 'told there is none' (JSON null) distinct from 'not told' (absent key)", async () => {
    const facts = (await product("T-1"))?.facts as Record<string, unknown>;
    expect("rp.name" in facts).toBe(false);
    const k1 = (await product("K-1"))?.facts as Record<string, unknown>;
    expect("manufacturer.address" in k1).toBe(false);
    await importRows(OWNER, acme, [{ sku: "T-1", facts: { "rp.name": null } }]);
    const after = (await product("T-1"))?.facts as Record<string, unknown>;
    expect("rp.name" in after && after["rp.name"] === null).toBe(true);
  });

  it("is all-or-nothing: one bad row fails the whole import", async () => {
    await expect(
      importRows(OWNER, acme, [{ sku: "OK-1", title: "fine" }, { sku: "BAD-1", manufacturer_country: "China" }]),
    ).rejects.toThrow(/check constraint/);
    expect(await product("OK-1")).toBeUndefined();
  });

  it("refuses the same SKU twice in one import", async () => {
    await expect(importRows(OWNER, acme, [{ sku: "D-1" }, { sku: " D-1 " }])).rejects.toThrow(/more than once/);
  });

  it("refuses more than 5000 rows", async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ sku: `S-${i}` }));
    await expect(importRows(OWNER, acme, rows)).rejects.toThrow(/at most 5000/);
  });

  it("a viewer cannot import", async () => {
    await expect(importRows(VIEWER, acme, [{ sku: "V-1" }])).rejects.toThrow(/row-level security/);
  });

  it("nobody can import into an organisation they don't belong to", async () => {
    await expect(importRows(OWNER, beta, [{ sku: "PLANTED-1" }])).rejects.toThrow(/row-level security/);
    await expect(importRows(OUTSIDER, acme, [{ sku: "PLANTED-2" }])).rejects.toThrow(/row-level security/);
  });

  it("anonymous callers cannot run it at all", async () => {
    await expect(
      as(db, { role: "anon" }, (tx) => tx.query("select * from public.import_products($1, '[]'::jsonb)", [acme])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("fact bags are scoped and can't shadow columns", () => {
  const setFacts = (sku: string, facts: unknown) =>
    as(db, user(OWNER), (tx) =>
      tx.query("update public.product set facts = $1::jsonb where organisation_id = $2 and sku = $3", [JSON.stringify(facts), acme, sku]),
    );

  it("accepts product, manufacturer and rp facts on a product", async () => {
    await expect(setFacts("K-1", { "product.weee_producer_registration_number": "DE123", "manufacturer.address": "1 Road", "rp.contact": null })).resolves.toBeDefined();
  });

  it("refuses organisation-level facts on a product", async () => {
    await expect(setFacts("K-1", { "organisation.vat_number": "GB1" })).rejects.toThrow(/product_facts_valid/);
  });

  it("refuses a fact that duplicates a typed column — the column is the only source of truth", async () => {
    await expect(setFacts("K-1", { "product.has_battery": false })).rejects.toThrow(/product_facts_valid/);
    await expect(setFacts("K-1", { "manufacturer.country": "DE" })).rejects.toThrow(/product_facts_valid/);
  });

  it("refuses a derived fact the catalog computes itself", async () => {
    await expect(setFacts("K-1", { "manufacturer.country_in_eu": true })).rejects.toThrow(/product_facts_valid/);
    await expect(
      as(db, user(OWNER), (tx) =>
        tx.query(`update public.organisation set facts = '{"organisation.established_in_market": true}'::jsonb where id = $1`, [acme]),
      ),
    ).rejects.toThrow(/organisation_facts_valid/);
  });

  it("refuses nested values — facts are scalars", async () => {
    await expect(setFacts("K-1", { "rp.name": { first: "a" } })).rejects.toThrow(/product_facts_valid/);
  });

  it("accepts organisation and packaging facts on the organisation, from an owner", async () => {
    const result = await as(db, user(OWNER), (tx) =>
      tx.query(`update public.organisation set facts = '{"organisation.vat_number": "GB123", "packaging.lucid_number": null}'::jsonb where id = $1`, [acme]),
    );
    expect(result.affectedRows).toBe(1);
  });
});

describe("target markets", () => {
  it("an owner can set them; they must be ISO alpha-2 codes", async () => {
    const ok = await as(db, user(OWNER), (tx) =>
      tx.query("update public.organisation set target_markets = array['DE','FR'] where id = $1", [acme]),
    );
    expect(ok.affectedRows).toBe(1);
    await expect(
      as(db, user(OWNER), (tx) => tx.query("update public.organisation set target_markets = array['Germany'] where id = $1", [acme])),
    ).rejects.toThrow(/organisation_target_markets_valid/);
  });

  it("a viewer cannot change them", async () => {
    const result = await as(db, user(VIEWER), (tx) =>
      tx.query("update public.organisation set target_markets = array['DE'] where id = $1", [acme]),
    );
    expect(result.affectedRows).toBe(0);
  });
});
