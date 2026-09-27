/**
 * Row-level security for the tenancy schema (supabase/migrations/*_tenancy.sql, D-048).
 *
 * The property that matters most in a product holding other companies' compliance documents: an
 * organisation's rows are invisible and untouchable to anyone who isn't a member of it, whatever
 * the application code asks for. These tests talk to the database directly, as each user, so
 * they prove what the database refuses — not what the UI happens not to ask.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, createDatabase, createUser, user } from "./support/db.ts";

const ALICE = "a0000000-0000-4000-8000-000000000001"; // owner, Acme
const ADAM = "a0000000-0000-4000-8000-000000000002"; // admin, Acme
const DAVE = "a0000000-0000-4000-8000-000000000003"; // member, Acme
const CAROL = "a0000000-0000-4000-8000-000000000004"; // viewer, Acme
const BOB = "b0000000-0000-4000-8000-000000000001"; // owner, Beta
const EVE = "e0000000-0000-4000-8000-000000000001"; // no memberships at all

let db: PGlite;
let acme: string;
let beta: string;
let acmeProduct: string;
let betaProduct: string;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, email] of [
    [ALICE, "alice@acme.test"], [ADAM, "adam@acme.test"], [DAVE, "dave@acme.test"],
    [CAROL, "carol@acme.test"], [BOB, "bob@beta.test"], [EVE, "eve@example.test"],
  ] as const) {
    await createUser(db, id, email);
  }

  acme = await as(db, user(ALICE), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Acme Ltd', 'GB') as id")).rows[0]!.id,
  { commit: true });
  beta = await as(db, user(BOB), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Beta GmbH', 'DE') as id")).rows[0]!.id,
  { commit: true });

  // Stands in for the invitation function (next increment) — added as the database owner.
  for (const [id, role] of [[ADAM, "admin"], [DAVE, "member"], [CAROL, "viewer"]] as const) {
    await db.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, $3)", [acme, id, role]);
  }
  acmeProduct = (await db.query<{ id: string }>(
    "insert into public.product (organisation_id, sku, title) values ($1, 'ACME-1', 'Acme kettle') returning id", [acme],
  )).rows[0]!.id;
  betaProduct = (await db.query<{ id: string }>(
    "insert into public.product (organisation_id, sku, title) values ($1, 'BETA-1', 'Beta lamp') returning id", [beta],
  )).rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id).sort();

describe("anonymous visitors", () => {
  it("cannot read any table", async () => {
    for (const table of ["organisation", "membership", "product", "audit_log"]) {
      await expect(as(db, anon, (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("cannot create an organisation", async () => {
    await expect(
      as(db, anon, (tx) => tx.query("select public.create_organisation('Sneaky', null)")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("organisation isolation", () => {
  it("each user sees exactly their own organisations", async () => {
    const aliceOrgs = await as(db, user(ALICE), (tx) => tx.query<{ id: string }>("select id from public.organisation"));
    const bobOrgs = await as(db, user(BOB), (tx) => tx.query<{ id: string }>("select id from public.organisation"));
    const eveOrgs = await as(db, user(EVE), (tx) => tx.query<{ id: string }>("select id from public.organisation"));
    expect(ids(aliceOrgs.rows)).toEqual([acme]);
    expect(ids(bobOrgs.rows)).toEqual([beta]);
    expect(eveOrgs.rows).toEqual([]);
  });

  it("never returns another organisation's products, even when asked for them by id", async () => {
    const all = await as(db, user(ALICE), (tx) => tx.query<{ id: string }>("select id from public.product"));
    expect(ids(all.rows)).toEqual([acmeProduct]);

    const byId = await as(db, user(ALICE), (tx) =>
      tx.query("select * from public.product where id = $1 or organisation_id = $2", [betaProduct, beta]),
    );
    expect(byId.rows).toEqual([]);
  });

  it("refuses to insert a product into an organisation you don't belong to", async () => {
    await expect(
      as(db, user(ALICE), (tx) =>
        tx.query("insert into public.product (organisation_id, sku) values ($1, 'PLANTED-1')", [beta]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot update or delete another organisation's products — they are simply not there", async () => {
    const updated = await as(db, user(ALICE), (tx) =>
      tx.query("update public.product set title = 'defaced' where id = $1", [betaProduct]),
    );
    const deleted = await as(db, user(ALICE), (tx) => tx.query("delete from public.product where id = $1", [betaProduct]));
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);
    const still = await db.query<{ title: string }>("select title from public.product where id = $1", [betaProduct]);
    expect(still.rows[0]?.title).toBe("Beta lamp");
  });

  it("cannot move a product into another organisation", async () => {
    await expect(
      as(db, user(ALICE), (tx) => tx.query("update public.product set organisation_id = $1 where id = $2", [beta, acmeProduct])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("roles within an organisation", () => {
  it("a viewer can read products but not add, change or remove them", async () => {
    const seen = await as(db, user(CAROL), (tx) => tx.query<{ id: string }>("select id from public.product"));
    expect(ids(seen.rows)).toEqual([acmeProduct]);

    await expect(
      as(db, user(CAROL), (tx) => tx.query("insert into public.product (organisation_id, sku) values ($1, 'V-1')", [acme])),
    ).rejects.toThrow(/row-level security/);
    const updated = await as(db, user(CAROL), (tx) =>
      tx.query("update public.product set title = 'x' where id = $1", [acmeProduct]),
    );
    const deleted = await as(db, user(CAROL), (tx) => tx.query("delete from public.product where id = $1", [acmeProduct]));
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);
  });

  it("a member can add and edit products", async () => {
    await as(db, user(DAVE), async (tx) => {
      await tx.query("insert into public.product (organisation_id, sku) values ($1, 'D-1')", [acme]);
      const updated = await tx.query("update public.product set title = 'Renamed' where id = $1", [acmeProduct]);
      expect(updated.affectedRows).toBe(1);
    });
  });

  it("only owners and admins can edit the organisation itself", async () => {
    const byViewer = await as(db, user(CAROL), (tx) =>
      tx.query("update public.organisation set name = 'x' where id = $1", [acme]),
    );
    const byMember = await as(db, user(DAVE), (tx) =>
      tx.query("update public.organisation set name = 'x' where id = $1", [acme]),
    );
    const byAdmin = await as(db, user(ADAM), (tx) =>
      tx.query("update public.organisation set name = 'Acme Trading Ltd' where id = $1", [acme]),
    );
    expect(byViewer.affectedRows).toBe(0);
    expect(byMember.affectedRows).toBe(0);
    expect(byAdmin.affectedRows).toBe(1);
  });

  it("nobody can delete an organisation from the app — that is the written deletion procedure (D-013)", async () => {
    await expect(
      as(db, user(ALICE), (tx) => tx.query("delete from public.organisation where id = $1", [acme])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("membership", () => {
  it("cannot be inserted directly — not by an outsider joining, not even by an owner", async () => {
    await expect(
      as(db, user(EVE), (tx) =>
        tx.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, 'owner')", [acme, EVE]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(ALICE), (tx) =>
        tx.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, 'member')", [acme, EVE]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("an admin cannot promote themselves to owner", async () => {
    await expect(
      as(db, user(ADAM), (tx) =>
        tx.query("update public.membership set role = 'owner' where organisation_id = $1 and user_id = $2", [acme, ADAM]),
      ),
    ).rejects.toThrow(/only an owner can/);
  });

  it("an admin cannot remove or demote the owner", async () => {
    await expect(
      as(db, user(ADAM), (tx) =>
        tx.query("delete from public.membership where organisation_id = $1 and user_id = $2", [acme, ALICE]),
      ),
    ).rejects.toThrow(/only an owner can/);
    await expect(
      as(db, user(ADAM), (tx) =>
        tx.query("update public.membership set role = 'viewer' where organisation_id = $1 and user_id = $2", [acme, ALICE]),
      ),
    ).rejects.toThrow(/only an owner can/);
  });

  it("an owner can change a member's role", async () => {
    const result = await as(db, user(ALICE), (tx) =>
      tx.query("update public.membership set role = 'admin' where organisation_id = $1 and user_id = $2", [acme, DAVE]),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("the last owner cannot leave or step down", async () => {
    await expect(
      as(db, user(ALICE), (tx) =>
        tx.query("delete from public.membership where organisation_id = $1 and user_id = $2", [acme, ALICE]),
      ),
    ).rejects.toThrow(/at least one owner/);
    await expect(
      as(db, user(ALICE), (tx) =>
        tx.query("update public.membership set role = 'admin' where organisation_id = $1 and user_id = $2", [acme, ALICE]),
      ),
    ).rejects.toThrow(/at least one owner/);
  });

  it("a member can leave; a viewer cannot remove anyone else", async () => {
    const left = await as(db, user(DAVE), (tx) =>
      tx.query("delete from public.membership where organisation_id = $1 and user_id = $2", [acme, DAVE]),
    );
    const removed = await as(db, user(CAROL), (tx) =>
      tx.query("delete from public.membership where organisation_id = $1 and user_id = $2", [acme, DAVE]),
    );
    expect(left.affectedRows).toBe(1);
    expect(removed.affectedRows).toBe(0);
  });

  it("cannot be moved to another user", async () => {
    await expect(
      as(db, user(ALICE), (tx) =>
        tx.query("update public.membership set user_id = $1 where organisation_id = $2 and user_id = $3", [EVE, acme, DAVE]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("creating an organisation", () => {
  it("makes the creator its owner, and nobody else can see it", async () => {
    await as(db, user(EVE), async (tx) => {
      const id = (await tx.query<{ id: string }>("select public.create_organisation('Eve Ventures') as id")).rows[0]!.id;
      const role = await tx.query<{ role: string }>(
        "select role from public.membership where organisation_id = $1 and user_id = $2", [id, EVE],
      );
      expect(role.rows[0]?.role).toBe("owner");
    }, { commit: true });

    const aliceSees = await as(db, user(ALICE), (tx) =>
      tx.query("select 1 from public.organisation where name = 'Eve Ventures'"),
    );
    expect(aliceSees.rows).toEqual([]);
  });

  it("stores an unstated establishment country as NULL — unknown, never assumed", async () => {
    const country = await as(db, user(EVE), (tx) =>
      tx.query<{ c: string | null }>("select establishment_country as c from public.organisation where name = 'Eve Ventures'"),
    );
    expect(country.rows[0]?.c).toBeNull();
  });

  it("rejects an establishment country that isn't an ISO alpha-2 code", async () => {
    await expect(
      as(db, user(EVE), (tx) => tx.query("select public.create_organisation('Bad', 'United Kingdom')")),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("the hard rule at the storage boundary", () => {
  it("a product saved with only a SKU has every yes/no fact NULL (unknown), never false", async () => {
    const row = await as(db, user(ALICE), async (tx) => {
      await tx.query("insert into public.product (organisation_id, sku) values ($1, 'BARE-1')", [acme]);
      return (await tx.query<Record<string, unknown>>(
        "select has_battery, is_electrical, is_toy, has_packaging from public.product where sku = 'BARE-1'",
      )).rows[0];
    });
    expect(row).toEqual({ has_battery: null, is_electrical: null, is_toy: null, has_packaging: null });
  });
});

describe("the audit log", () => {
  it("records who changed what, visible to owners and admins of that organisation only", async () => {
    await as(db, user(ALICE), (tx) =>
      tx.query("update public.product set title = 'Audited kettle' where id = $1", [acmeProduct]),
    { commit: true });

    const ownerView = await as(db, user(ALICE), (tx) =>
      tx.query<{ actor: string; action: string }>(
        "select actor, action from public.audit_log where entity = 'product' and entity_id = $1 and action = 'UPDATE'",
        [acmeProduct],
      ),
    );
    expect(ownerView.rows).toContainEqual({ actor: ALICE, action: "UPDATE" });

    const viewerView = await as(db, user(CAROL), (tx) => tx.query("select * from public.audit_log"));
    const outsiderView = await as(db, user(BOB), (tx) =>
      tx.query("select * from public.audit_log where organisation_id = $1", [acme]),
    );
    expect(viewerView.rows).toEqual([]);
    expect(outsiderView.rows).toEqual([]);
  });

  it("cannot be edited or deleted by an app user", async () => {
    await expect(as(db, user(ALICE), (tx) => tx.query("update public.audit_log set action = 'DELETE'"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(db, user(ALICE), (tx) => tx.query("delete from public.audit_log"))).rejects.toThrow(/permission denied/);
  });

  it("cannot be edited, deleted or truncated even by the database owner", async () => {
    await expect(db.query("update public.audit_log set action = 'DELETE'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.audit_log")).rejects.toThrow(/append-only/);
    await expect(db.query("truncate public.audit_log")).rejects.toThrow(/append-only/);
  });
});

describe("system actions", () => {
  it("deleting an organisation as the system cascades cleanly, and its audit history survives", async () => {
    await db.transaction(async (tx) => {
      await tx.query("delete from public.organisation where id = $1", [acme]);
      const members = await tx.query("select 1 from public.membership where organisation_id = $1", [acme]);
      const history = await tx.query("select 1 from public.audit_log where organisation_id = $1", [acme]);
      expect(members.rows).toEqual([]);
      expect(history.rows.length).toBeGreaterThan(0);
      await tx.rollback();
    });
  });
});
