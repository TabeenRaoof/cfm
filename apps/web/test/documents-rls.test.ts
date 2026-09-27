/**
 * Documents, extractions and product links (supabase/migrations/*_documents.sql, D-051).
 * The property: evidence comes only from rows no client can write, and a document can only ever
 * be linked to products in its own organisation.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const OWNER = "a0000000-0000-4000-8000-000000000001";
const MEMBER = "a0000000-0000-4000-8000-000000000002";
const VIEWER = "a0000000-0000-4000-8000-000000000003";
const BOTH = "d0000000-0000-4000-8000-000000000001"; // member of Acme AND Beta
const BETA_OWNER = "b0000000-0000-4000-8000-000000000001";
const SHA = "a".repeat(64);

let db: PGlite;
let acme: string;
let beta: string;
let acmeDoc: string;
let acmeProduct: string;
let betaProduct: string;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, email] of [[OWNER, "o@acme.test"], [MEMBER, "m@acme.test"], [VIEWER, "v@acme.test"], [BOTH, "both@x.test"], [BETA_OWNER, "o@beta.test"]] as const) {
    await createUser(db, id, email);
  }
  acme = await as(db, user(OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Acme') as id")).rows[0]!.id, { commit: true });
  beta = await as(db, user(BETA_OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Beta') as id")).rows[0]!.id, { commit: true });
  for (const [org, id, role] of [[acme, MEMBER, "member"], [acme, VIEWER, "viewer"], [acme, BOTH, "member"], [beta, BOTH, "member"]] as const) {
    await db.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, $3)", [org, id, role]);
  }
  acmeProduct = (await db.query<{ id: string }>("insert into public.product (organisation_id, sku) values ($1, 'A-1') returning id", [acme])).rows[0]!.id;
  betaProduct = (await db.query<{ id: string }>("insert into public.product (organisation_id, sku) values ($1, 'B-1') returning id", [beta])).rows[0]!.id;
  // Written as the Worker would, with the service role (here: the database owner).
  acmeDoc = (await db.query<{ id: string }>(
    `insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key, uploaded_by)
     values ($1::uuid, 'rp_mandate', 'mandate.pdf', 'application/pdf', 1234, $2, $1::text || '/doc-1.pdf', $3) returning id`,
    [acme, SHA, MEMBER],
  )).rows[0]!.id;
  await db.query(
    `insert into public.extraction (document_id, organisation_id, doc_type, decision, verdict, source, used_model)
     values ($1, $2, 'rp_mandate', 'accept', '{"decision":"accept","fields":[]}', 'pipeline', true)`,
    [acmeDoc, acme],
  );
});

afterAll(async () => {
  await db.close();
});

describe("documents and extractions are read-only to every client", () => {
  it("members of the organisation can read them; outsiders see nothing", async () => {
    const seen = await as(db, user(VIEWER), (tx) => tx.query("select id from public.document"));
    const extraction = await as(db, user(VIEWER), (tx) => tx.query("select id from public.extraction"));
    const outsider = await as(db, user(BETA_OWNER), (tx) => tx.query("select id from public.document where organisation_id = $1", [acme]));
    expect(seen.rows).toHaveLength(1);
    expect(extraction.rows).toHaveLength(1);
    expect(outsider.rows).toEqual([]);
  });

  it("not even an owner can insert, edit or delete a document", async () => {
    await expect(as(db, user(OWNER), (tx) =>
      tx.query(`insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key)
                values ($1::uuid, 'rp_mandate', 'x.pdf', 'application/pdf', 1, $2, $1::text || '/x.pdf')`, [acme, "b".repeat(64)]),
    )).rejects.toThrow(/permission denied/);
    await expect(as(db, user(OWNER), (tx) => tx.query("update public.document set status = 'accepted'"))).rejects.toThrow(/permission denied/);
    await expect(as(db, user(OWNER), (tx) => tx.query("delete from public.document"))).rejects.toThrow(/permission denied/);
  });

  it("no client can write an extraction — so no client can write itself evidence", async () => {
    await expect(as(db, user(OWNER), (tx) =>
      tx.query(`insert into public.extraction (document_id, organisation_id, doc_type, decision, verdict, source, used_model)
                values ($1, $2, 'rp_mandate', 'accept', '{}', 'pipeline', false)`, [acmeDoc, acme]),
    )).rejects.toThrow(/permission denied/);
    await expect(as(db, user(OWNER), (tx) => tx.query("update public.extraction set decision = 'accept'"))).rejects.toThrow(/permission denied/);
  });
});

describe("document constraints", () => {
  it("a storage key must sit under the document's own organisation", async () => {
    await expect(db.query(
      `insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key)
       values ($1, 'rp_mandate', 'x.pdf', 'application/pdf', 1, $2, $3 || '/stolen.pdf')`, [acme, "c".repeat(64), beta],
    )).rejects.toThrow(/check constraint/);
  });

  it("the same file twice in one organisation is one document", async () => {
    await expect(db.query(
      `insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key)
       values ($1::uuid, 'rp_mandate', 'again.pdf', 'application/pdf', 1234, $2, $1::text || '/doc-2.pdf')`, [acme, SHA],
    )).rejects.toThrow(/duplicate key/);
  });

  it("only the Slice B types, and only PDF/PNG/JPEG under 10 MB", async () => {
    const insert = (type: string, mime: string, size: number, sha: string) => db.query(
      `insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key)
       values ($1::uuid, $2, 'f', $3, $4, $5, $1::text || '/' || $5)`, [acme, type, mime, size, sha]);
    await expect(insert("test_report", "application/pdf", 1, "d".repeat(64))).rejects.toThrow(/check constraint/);
    await expect(insert("rp_mandate", "application/zip", 1, "e".repeat(64))).rejects.toThrow(/check constraint/);
    await expect(insert("rp_mandate", "application/pdf", 20_000_000, "f".repeat(64))).rejects.toThrow(/check constraint/);
  });

  it("a human-reviewed extraction must name its reviewer, and a pipeline one must not", async () => {
    await expect(db.query(
      `insert into public.extraction (document_id, organisation_id, doc_type, decision, verdict, source, used_model)
       values ($1, $2, 'rp_mandate', 'accept', '{}', 'human', false)`, [acmeDoc, acme],
    )).rejects.toThrow(/check constraint/);
    await expect(db.query(
      `insert into public.extraction (document_id, organisation_id, doc_type, decision, verdict, source, used_model, reviewed_by)
       values ($1, $2, 'rp_mandate', 'accept', '{}', 'pipeline', true, $3)`, [acmeDoc, acme, OWNER],
    )).rejects.toThrow(/check constraint/);
  });
});

describe("linking documents to products", () => {
  it("a member links their organisation's document to their organisation's product", async () => {
    await as(db, user(MEMBER), (tx) =>
      tx.query("insert into public.document_product (document_id, product_id, organisation_id) values ($1, $2, $3)", [acmeDoc, acmeProduct, acme]),
    { commit: true });
    const links = await as(db, user(VIEWER), (tx) => tx.query<{ created_by: string }>("select created_by from public.document_product"));
    expect(links.rows).toEqual([{ created_by: MEMBER }]);
  });

  it("someone in two organisations still can't link one's document to the other's product", async () => {
    await expect(as(db, user(BOTH), (tx) =>
      tx.query("insert into public.document_product (document_id, product_id, organisation_id) values ($1, $2, $3)", [acmeDoc, betaProduct, acme]),
    )).rejects.toThrow(/foreign key/);
    await expect(as(db, user(BOTH), (tx) =>
      tx.query("insert into public.document_product (document_id, product_id, organisation_id) values ($1, $2, $3)", [acmeDoc, betaProduct, beta]),
    )).rejects.toThrow(/foreign key/);
  });

  it("a viewer cannot link or unlink", async () => {
    await expect(as(db, user(VIEWER), (tx) =>
      tx.query("insert into public.document_product (document_id, product_id, organisation_id) values ($1, $2, $3)", [acmeDoc, acmeProduct, acme]),
    )).rejects.toThrow(/row-level security|duplicate key/);
    const unlinked = await as(db, user(VIEWER), (tx) => tx.query("delete from public.document_product"));
    expect(unlinked.affectedRows).toBe(0);
  });

  it("the link's author can't be spoofed", async () => {
    await expect(as(db, user(MEMBER), (tx) =>
      tx.query("insert into public.document_product (document_id, product_id, organisation_id, created_by) values ($1, $2, $3, $4)", [acmeDoc, acmeProduct, acme, OWNER]),
    )).rejects.toThrow(/permission denied/);
  });

  it("links, uploads and extractions are all in the audit log", async () => {
    const entities = await db.query<{ entity: string }>(
      "select distinct entity from public.audit_log where organisation_id = $1 and entity in ('document','extraction','document_product') order by entity", [acme]);
    expect(entities.rows.map((r) => r.entity)).toEqual(["document", "document_product", "extraction"]);
  });
});

describe("the Worker's write functions", () => {
  const register = (actor: string, org: string, sha: string, products: string[] = []) =>
    db.query<{ id: string }>(
      `select public.register_document($1, $2::uuid, 'epr_certificate', 'cert.pdf', 'application/pdf', 2048, $3, $2::text || '/' || $3, $4::uuid[]) as id`,
      [actor, org, sha, products],
    );

  it("no client can call them — not even an owner", async () => {
    await expect(as(db, user(OWNER), (tx) =>
      tx.query(`select public.register_document($1, $2::uuid, 'epr_certificate', 'x.pdf', 'application/pdf', 1, $3, $2::text || '/x', '{}')`, [OWNER, acme, "1".repeat(64)]),
    )).rejects.toThrow(/permission denied/);
    await expect(as(db, user(OWNER), (tx) => tx.query("select public.delete_document($1, $2)", [OWNER, acmeDoc]))).rejects.toThrow(/permission denied/);
    await expect(as(db, user(OWNER), (tx) => tx.query("select public.record_extraction(null, '{}'::jsonb, 'accepted')"))).rejects.toThrow(/permission denied/);
  });

  it("register_document refuses an actor who can't upload to that organisation, even from the service role", async () => {
    await expect(register(VIEWER, acme, "2".repeat(64))).rejects.toThrow(/not permitted/);
    await expect(register(BETA_OWNER, acme, "3".repeat(64))).rejects.toThrow(/not permitted/);
  });

  it("register_document records the uploader, the product links, and the real actor in the audit log", async () => {
    const id = (await register(MEMBER, acme, "4".repeat(64), [acmeProduct])).rows[0]!.id;
    const doc = await db.query<{ uploaded_by: string }>("select uploaded_by from public.document where id = $1", [id]);
    const links = await db.query("select 1 from public.document_product where document_id = $1", [id]);
    const audit = await db.query<{ actor: string }>("select actor from public.audit_log where entity = 'document' and entity_id = $1 and action = 'INSERT'", [id]);
    expect(doc.rows[0]?.uploaded_by).toBe(MEMBER);
    expect(links.rows).toHaveLength(1);
    expect(audit.rows[0]?.actor).toBe(MEMBER);
  });

  it("register_document can't link another organisation's product", async () => {
    await expect(register(BOTH, acme, "5".repeat(64), [betaProduct])).rejects.toThrow(/foreign key/);
  });

  it("delete_document needs owner or admin, returns the storage key, and logs who deleted", async () => {
    const id = (await register(MEMBER, acme, "6".repeat(64))).rows[0]!.id;
    await expect(db.query("select public.delete_document($1, $2)", [MEMBER, id])).rejects.toThrow(/not permitted/);
    const key = await db.query<{ key: string }>("select public.delete_document($1, $2) as key", [OWNER, id]);
    expect(key.rows[0]?.key).toBe(`${acme}/${"6".repeat(64)}`);
    const audit = await db.query<{ actor: string }>("select actor from public.audit_log where entity = 'document' and entity_id = $1 and action = 'DELETE'", [id]);
    expect(audit.rows[0]?.actor).toBe(OWNER);
  });

  it("record_extraction stores a human review under the reviewer and moves the status in the same step", async () => {
    await db.query("select public.record_extraction($1, $2::jsonb, 'accepted')", [MEMBER, JSON.stringify({
      document_id: acmeDoc, organisation_id: acme, doc_type: "rp_mandate", decision: "accept",
      verdict: { decision: "accept", fields: [] }, source: "human", reviewed_by: MEMBER, used_model: false,
    })]);
    const status = await db.query<{ status: string }>("select status from public.document where id = $1", [acmeDoc]);
    const audit = await db.query<{ actor: string }>("select actor from public.audit_log where entity = 'extraction' and action = 'INSERT' order by id desc limit 1");
    expect(status.rows[0]?.status).toBe("accepted");
    expect(audit.rows[0]?.actor).toBe(MEMBER);
  });

  it("record_extraction refuses a human review from someone who isn't a member+", async () => {
    await expect(db.query("select public.record_extraction($1, $2::jsonb, 'accepted')", [VIEWER, JSON.stringify({
      document_id: acmeDoc, organisation_id: acme, doc_type: "rp_mandate", decision: "accept",
      verdict: {}, source: "human", reviewed_by: VIEWER, used_model: false,
    })])).rejects.toThrow(/not permitted/);
  });
});
