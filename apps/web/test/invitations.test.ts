/**
 * Invitations (supabase/migrations/*_facts_invitations_import.sql, D-050). The property that
 * matters: the only way into an organisation is an invitation an owner or admin created, accepted
 * by someone who has proved they own the invited address.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const OWNER = "a0000000-0000-4000-8000-000000000001";
const ADMIN = "a0000000-0000-4000-8000-000000000002";
const VIEWER = "a0000000-0000-4000-8000-000000000003";
const OUTSIDER = "b0000000-0000-4000-8000-000000000001";
const INVITEE = "c0000000-0000-4000-8000-000000000001";
const UNCONFIRMED = "c0000000-0000-4000-8000-000000000002";

let db: PGlite;
let acme: string;

async function invite(by: string, email: string, role: string) {
  return as(db, user(by), (tx) =>
    tx.query<{ id: string; invited_by: string; expires_at: string }>(
      "insert into public.invitation (organisation_id, email, role) values ($1, $2, $3) returning id, invited_by, expires_at",
      [acme, email, role],
    ),
  { commit: true });
}

async function membershipRole(userId: string): Promise<string | undefined> {
  const result = await db.query<{ role: string }>(
    "select role from public.membership where organisation_id = $1 and user_id = $2", [acme, userId],
  );
  return result.rows[0]?.role;
}

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, OWNER, "owner@acme.test");
  await createUser(db, ADMIN, "admin@acme.test");
  await createUser(db, VIEWER, "viewer@acme.test");
  await createUser(db, OUTSIDER, "outsider@beta.test");
  await createUser(db, INVITEE, "new.person@example.test");
  await createUser(db, UNCONFIRMED, "unconfirmed@example.test", { confirmed: false });

  acme = await as(db, user(OWNER), async (tx) =>
    (await tx.query<{ id: string }>("select public.create_organisation('Acme Ltd', 'GB') as id")).rows[0]!.id,
  { commit: true });
  for (const [id, role] of [[ADMIN, "admin"], [VIEWER, "viewer"]] as const) {
    await db.query("insert into public.membership (organisation_id, user_id, role) values ($1, $2, $3)", [acme, id, role]);
  }
});

afterAll(async () => {
  await db.close();
});

describe("creating an invitation", () => {
  it("an admin can invite, and the invitation records who sent it and expires", async () => {
    const created = await invite(ADMIN, "new.person@example.test", "member");
    expect(created.rows[0]?.invited_by).toBe(ADMIN);
    expect(new Date(created.rows[0]!.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("a viewer cannot invite", async () => {
    await expect(invite(VIEWER, "someone@example.test", "member")).rejects.toThrow(/row-level security/);
  });

  it("an outsider cannot invite into an organisation they don't belong to", async () => {
    await expect(invite(OUTSIDER, "accomplice@example.test", "admin")).rejects.toThrow(/row-level security/);
  });

  it("nobody can be invited as owner — owners are made by promotion", async () => {
    await expect(invite(OWNER, "would.be.owner@example.test", "owner")).rejects.toThrow(/check constraint/);
  });

  it("cannot claim to be from someone else, or set its own expiry", async () => {
    await expect(
      as(db, user(ADMIN), (tx) =>
        tx.query("insert into public.invitation (organisation_id, email, role, invited_by) values ($1, 'x@example.test', 'member', $2)", [acme, OWNER]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(ADMIN), (tx) =>
        tx.query("insert into public.invitation (organisation_id, email, role, expires_at) values ($1, 'x@example.test', 'member', '2099-01-01')", [acme]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("stores addresses lower-cased only — a mixed-case address is refused, not silently duplicated", async () => {
    await expect(invite(OWNER, "Mixed.Case@Example.test", "member")).rejects.toThrow(/check constraint/);
  });

  it("is visible to owners and admins, not to viewers or outsiders", async () => {
    const byAdmin = await as(db, user(ADMIN), (tx) => tx.query("select email from public.invitation"));
    const byViewer = await as(db, user(VIEWER), (tx) => tx.query("select email from public.invitation"));
    const byOutsider = await as(db, user(OUTSIDER), (tx) => tx.query("select email from public.invitation"));
    expect(byAdmin.rows.length).toBeGreaterThan(0);
    expect(byViewer.rows).toEqual([]);
    expect(byOutsider.rows).toEqual([]);
  });
});

describe("accepting an invitation", () => {
  it("the invited person sees it — organisation name included — before they are a member", async () => {
    const mine = await as(db, user(INVITEE), (tx) =>
      tx.query<{ organisation_name: string; role: string }>("select organisation_name, role from public.my_invitations()"),
    );
    expect(mine.rows).toEqual([{ organisation_name: "Acme Ltd", role: "member" }]);
  });

  it("someone else cannot see or accept it", async () => {
    const theirs = await as(db, user(OUTSIDER), (tx) => tx.query("select * from public.my_invitations()"));
    expect(theirs.rows).toEqual([]);

    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'new.person@example.test'")).rows[0]!.id;
    await expect(
      as(db, user(OUTSIDER), (tx) => tx.query("select public.accept_invitation($1)", [id])),
    ).rejects.toThrow(/different email/);
    expect(await membershipRole(OUTSIDER)).toBeUndefined();
  });

  it("accepting makes them a member with the invited role, and uses up the invitation", async () => {
    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'new.person@example.test'")).rows[0]!.id;
    await as(db, user(INVITEE), (tx) => tx.query("select public.accept_invitation($1)", [id]), { commit: true });

    expect(await membershipRole(INVITEE)).toBe("member");
    const orgs = await as(db, user(INVITEE), (tx) => tx.query<{ name: string }>("select name from public.organisation"));
    expect(orgs.rows).toEqual([{ name: "Acme Ltd" }]);

    const again = await db.query("select 1 from public.invitation where id = $1", [id]);
    expect(again.rows).toEqual([]);
  });

  it("an address that hasn't been confirmed cannot accept", async () => {
    await invite(OWNER, "unconfirmed@example.test", "admin");
    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'unconfirmed@example.test'")).rows[0]!.id;
    await expect(
      as(db, user(UNCONFIRMED), (tx) => tx.query("select public.accept_invitation($1)", [id])),
    ).rejects.toThrow(/confirm your email/);
    const listed = await as(db, user(UNCONFIRMED), (tx) => tx.query("select * from public.my_invitations()"));
    expect(listed.rows).toEqual([]);
  });

  it("an expired invitation cannot be accepted", async () => {
    await invite(OWNER, "late.person@example.test", "member");
    await db.query("update public.invitation set expires_at = now() - interval '1 day' where email = 'late.person@example.test'");
    const LATE = "c0000000-0000-4000-8000-000000000003";
    await createUser(db, LATE, "late.person@example.test");
    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'late.person@example.test'")).rows[0]!.id;
    await expect(as(db, user(LATE), (tx) => tx.query("select public.accept_invitation($1)", [id]))).rejects.toThrow(/expired/);
  });

  it("never changes the role of someone who is already a member", async () => {
    await invite(OWNER, "viewer@acme.test", "admin");
    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'viewer@acme.test'")).rows[0]!.id;
    await as(db, user(VIEWER), (tx) => tx.query("select public.accept_invitation($1)", [id]), { commit: true });
    expect(await membershipRole(VIEWER)).toBe("viewer");
  });
});

describe("declining and revoking", () => {
  it("the invited person can decline; nobody else can decline it for them", async () => {
    await invite(OWNER, "maybe@example.test", "member");
    const MAYBE = "c0000000-0000-4000-8000-000000000004";
    await createUser(db, MAYBE, "maybe@example.test");
    const id = (await db.query<{ id: string }>("select id from public.invitation where email = 'maybe@example.test'")).rows[0]!.id;

    await as(db, user(OUTSIDER), (tx) => tx.query("select public.decline_invitation($1)", [id]), { commit: true });
    expect((await db.query("select 1 from public.invitation where id = $1", [id])).rows.length).toBe(1);

    await as(db, user(MAYBE), (tx) => tx.query("select public.decline_invitation($1)", [id]), { commit: true });
    expect((await db.query("select 1 from public.invitation where id = $1", [id])).rows).toEqual([]);
  });

  it("an admin can revoke a pending invitation; a viewer cannot", async () => {
    await invite(OWNER, "revoke.me@example.test", "member");
    const byViewer = await as(db, user(VIEWER), (tx) =>
      tx.query("delete from public.invitation where email = 'revoke.me@example.test'"),
    );
    const byAdmin = await as(db, user(ADMIN), (tx) =>
      tx.query("delete from public.invitation where email = 'revoke.me@example.test'"),
    );
    expect(byViewer.affectedRows).toBe(0);
    expect(byAdmin.affectedRows).toBe(1);
  });

  it("every invitation event is in the audit log — including the database owner's direct edit", async () => {
    const actions = await db.query<{ action: string }>(
      "select distinct action from public.audit_log where entity = 'invitation' order by action",
    );
    // INSERT and DELETE from the app; UPDATE from the expiry test above, made as the database
    // owner with no app user behind it — logged all the same, with a NULL actor.
    expect(actions.rows.map((r) => r.action)).toEqual(["DELETE", "INSERT", "UPDATE"]);
    const ownerEdit = await db.query<{ actor: string | null }>(
      "select actor from public.audit_log where entity = 'invitation' and action = 'UPDATE'",
    );
    expect(ownerEdit.rows.every((r) => r.actor === null)).toBe(true);
  });
});

describe("organisation_members", () => {
  it("lists members with their email addresses — to members only", async () => {
    const byMember = await as(db, user(VIEWER), (tx) =>
      tx.query<{ email: string; role: string }>("select email, role from public.organisation_members($1)", [acme]),
    );
    expect(byMember.rows).toContainEqual({ email: "owner@acme.test", role: "owner" });
    expect(byMember.rows).toContainEqual({ email: "new.person@example.test", role: "member" });

    const byOutsider = await as(db, user(OUTSIDER), (tx) =>
      tx.query("select * from public.organisation_members($1)", [acme]),
    );
    expect(byOutsider.rows).toEqual([]);
  });
});
