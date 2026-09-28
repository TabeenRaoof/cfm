/**
 * Organisation erasure (supabase/migrations/*_erase_organisation.sql, D-054). The property: after
 * erase_organisation, nothing personal about that organisation survives anywhere in the database —
 * change history included — while every other organisation's data and history is untouched, and a
 * living organisation's history still cannot be altered by anyone.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const ACME_OWNER = "a0000000-0000-4000-8000-000000000001";
const BETA_OWNER = "b0000000-0000-4000-8000-000000000001";
const SHA = "c".repeat(64);

// Personal data that passes through Acme's history: a responsible person and an invitee.
const RP_NAME = "Renate Personenschutz";
const INVITEE = "invitee.erasure@example.test";

const TABLES = ["membership", "product", "invitation", "document", "extraction", "document_product"] as const;

let db: PGlite;
let acme: string;
let beta: string;

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number((await db.query<{ n: string }>(sql, params)).rows[0]!.n);
}

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, ACME_OWNER, "o@acme.test");
  await createUser(db, BETA_OWNER, "o@beta.test");
  acme = await as(db, user(ACME_OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Acme GmbH') as id")).rows[0]!.id, { commit: true });
  beta = await as(db, user(BETA_OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Beta Ltd') as id")).rows[0]!.id, { commit: true });

  for (const org of [acme, beta]) {
    const owner = org === acme ? ACME_OWNER : BETA_OWNER;
    await as(db, user(owner), async (tx) => {
      const product = (await tx.query<{ id: string }>(
        "insert into public.product (organisation_id, sku) values ($1, 'SKU-1') returning id", [org],
      )).rows[0]!.id;
      // An update, so the history holds before *and* after copies containing the name.
      await tx.query("update public.product set facts = $2 where id = $1", [product, { "rp.name": RP_NAME }]);
      await tx.query("update public.product set facts = $2 where id = $1", [product, { "rp.name": `${RP_NAME} II` }]);
      await tx.query("insert into public.invitation (organisation_id, email, role) values ($1, $2, 'member')", [org, INVITEE]);
    }, { commit: true });
    const product = (await db.query<{ id: string }>("select id from public.product where organisation_id = $1", [org])).rows[0]!.id;
    const doc = (await db.query<{ id: string }>(
      `insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key, uploaded_by)
       values ($1::uuid, 'rp_mandate', 'mandate.pdf', 'application/pdf', 10, $2, $1::text || '/' || $2, $3) returning id`,
      [org, SHA, owner],
    )).rows[0]!.id;
    await db.query(
      `insert into public.extraction (document_id, organisation_id, doc_type, decision, verdict, source, used_model)
       values ($1, $2, 'rp_mandate', 'accept', $3, 'pipeline', true)`,
      [doc, org, { decision: "accept", fields: [{ key: "rp.name", value: RP_NAME }] }],
    );
    await db.query("insert into public.document_product (document_id, product_id, organisation_id) values ($1, $2, $3)", [doc, product, org]);
  }
});

afterAll(async () => {
  await db.close();
});

describe("who may erase", () => {
  it("only the service role can execute erase_organisation", async () => {
    const may = async (role: string) =>
      (await db.query<{ ok: boolean }>("select has_function_privilege($1, 'public.erase_organisation(uuid)', 'execute') as ok", [role])).rows[0]!.ok;
    expect(await may("service_role")).toBe(true);
    expect(await may("authenticated")).toBe(false);
    expect(await may("anon")).toBe(false);
  });

  it("not even an organisation's own owner, through the API", async () => {
    await expect(as(db, user(ACME_OWNER), (tx) => tx.query("select public.erase_organisation($1)", [acme]))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("a living organisation's history stays append-only", () => {
  it("even with the erasure flag set for it, by the database owner", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('cfm.erasing_organisation', $1, true)", [acme]);
      await expect(tx.query("delete from public.audit_log where organisation_id = $1", [acme])).rejects.toThrow(/append-only/);
    });
    await expect(db.query("update public.audit_log set entity = 'x' where organisation_id = $1", [acme])).rejects.toThrow(/append-only/);
    await expect(db.query("truncate public.audit_log")).rejects.toThrow(/append-only/);
  });
});

describe("erase_organisation", () => {
  let betaAuditBefore: number;
  let result: { storage_keys: string[]; audit_rows_erased: number };

  beforeAll(async () => {
    expect(await count("select count(*) as n from public.audit_log where organisation_id = $1 and (before::text like $2 or after::text like $2)", [acme, `%${RP_NAME}%`])).toBeGreaterThan(0);
    expect(await count("select count(*) as n from public.audit_log where organisation_id = $1 and after::text like $2", [acme, `%${INVITEE}%`])).toBe(1);
    betaAuditBefore = await count("select count(*) as n from public.audit_log where organisation_id = $1", [beta]);
    result = (await db.query<{ r: typeof result }>("select public.erase_organisation($1) as r", [acme])).rows[0]!.r;
  });

  it("returns the storage keys whose files the operator must remove from R2", () => {
    expect(result.storage_keys).toEqual([`${acme}/${SHA}`]);
    expect(result.audit_rows_erased).toBeGreaterThan(0);
  });

  it("deletes the organisation and every row belonging to it", async () => {
    expect(await count("select count(*) as n from public.organisation where id = $1", [acme])).toBe(0);
    for (const table of TABLES) {
      expect(await count(`select count(*) as n from public.${table} where organisation_id = $1`, [acme]), table).toBe(0);
    }
  });

  it("leaves no personal data in the change history — only a content-free tombstone", async () => {
    const left = await db.query<{ action: string; entity: string; actor: string | null; before: unknown; after: unknown }>(
      "select action, entity, actor, before, after from public.audit_log where organisation_id = $1", [acme],
    );
    expect(left.rows).toEqual([{ action: "DELETE", entity: "erasure", actor: null, before: null, after: null }]);
    const anywhere = `%${acme}%`;
    expect(await count("select count(*) as n from public.audit_log where (before::text like $1 or after::text like $1)", [anywhere])).toBe(0);
  });

  it("does not touch another organisation's data or history", async () => {
    expect(await count("select count(*) as n from public.audit_log where organisation_id = $1", [beta])).toBe(betaAuditBefore);
    for (const table of TABLES) {
      expect(await count(`select count(*) as n from public.${table} where organisation_id = $1`, [beta]), table).toBeGreaterThan(0);
    }
    expect(await count("select count(*) as n from public.audit_log where organisation_id = $1 and after::text like $2", [beta, `%${RP_NAME}%`])).toBeGreaterThan(0);
  });

  it("keeps the accounts — they are Supabase's, and may belong elsewhere", async () => {
    expect(await count("select count(*) as n from auth.users where id = $1", [ACME_OWNER])).toBe(1);
  });

  it("refuses an organisation that does not exist", async () => {
    await expect(db.query("select public.erase_organisation($1)", [acme])).rejects.toThrow(/organisation not found/);
  });
});
