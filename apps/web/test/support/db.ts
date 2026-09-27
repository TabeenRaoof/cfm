/**
 * An in-process Postgres 17 (PGlite) with just enough of Supabase's `auth` schema for the
 * migrations to run unmodified, so the row-level security tests exercise the real SQL rather
 * than a model of it. No Docker, no Supabase account, runs in CI.
 *
 * What the shim mirrors: the `anon`, `authenticated` and `service_role` roles, `auth.users`, and
 * `auth.uid()` reading the JWT's `sub` claim from `request.jwt.claims`, the way Supabase's
 * PostgREST sets it per request. What it doesn't: GoTrue itself (sign-in, tokens). That is
 * Supabase's code, not ours — the thing under test here is our policies.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url).pathname;

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) await db.exec(await readFile(join(MIGRATIONS, file), "utf8"));
  return db;
}

/** Confirmed by default — a magic-link sign-in confirms the address, which is the normal case. */
export async function createUser(
  db: PGlite,
  id: string,
  email: string,
  options: { readonly confirmed?: boolean } = {},
): Promise<void> {
  await db.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
    id,
    email,
    options.confirmed === false ? null : new Date().toISOString(),
  ]);
}

type Who = { readonly role: "anon" } | { readonly role: "authenticated"; readonly userId: string };

/**
 * Runs `fn` as a request from `who` would — `set local role` plus the JWT claims — inside a
 * transaction that is rolled back afterwards unless `commit` is set, so each test starts from the
 * same fixture. An error inside `fn` rejects, and the transaction is rolled back either way.
 */
export async function as<T>(
  db: PGlite,
  who: Who,
  fn: (tx: Transaction) => Promise<T>,
  options: { readonly commit?: boolean } = {},
): Promise<T> {
  let result: T | undefined;
  await db.transaction(async (tx) => {
    await tx.exec(`set local role ${who.role}`);
    const claims = who.role === "authenticated" ? JSON.stringify({ sub: who.userId, role: who.role }) : "";
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    result = await fn(tx);
    if (!options.commit) await tx.rollback();
  });
  return result as T;
}

export const user = (userId: string): Who => ({ role: "authenticated", userId });
export const anon: Who = { role: "anon" };
