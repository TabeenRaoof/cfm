/**
 * End-to-end check against a LOCAL Supabase stack (`npx supabase start` in apps/web):
 * real GoTrue sign-in, real PostgREST, the real migrations — the parts PGlite can't stand in for.
 * It makes the same calls the app makes (src/Workspace.tsx, src/Products.tsx, src/SignIn.tsx).
 *
 *   cd apps/web && npx supabase start
 *   npm run -w @cfm/web e2e:local
 *
 * Refuses to run against anything but localhost: it creates and deletes users with the secret
 * key. Keys are read from `supabase status` and never printed.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const status = Object.fromEntries(
  execFileSync("npx", ["supabase", "status", "-o", "env"], { cwd: appRoot, encoding: "utf8" })
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
) as Record<string, string | undefined>;

const url = status.API_URL;
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
const mailpit = status.MAILPIT_URL ?? status.INBUCKET_URL;

if (!url || !publishable || !secret) throw new Error("Local Supabase isn't running — `npx supabase start` in apps/web.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to run against ${url}: this script creates users with the secret key and is local-only.`);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin = createClient(url, secret, noSession);
const run = Date.now().toString(36);
const password = `e2e-${run}-Password!`;
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function signedIn(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(url!, publishable!, noSession);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { client, id: created.data.user.id };
}

const alice = await signedIn(`alice-${run}@e2e.test`);
const bob = await signedIn(`bob-${run}@e2e.test`);
const orgIds: string[] = [];

try {
  // Alice: create an organisation (src/Workspace.tsx CreateOrganisation)
  const created = await alice.client.rpc("create_organisation", { p_name: `E2E Acme ${run}`, p_establishment_country: "GB" });
  check("signed-in user can create an organisation", !created.error && typeof created.data === "string", created.error?.message);
  const acme = created.data as string;
  orgIds.push(acme);

  // Alice: the exact membership query the app runs, with the organisation embedded
  const mine = await alice.client
    .from("membership")
    .select("role, organisation:organisation_id (id, name, establishment_country)")
    .eq("user_id", alice.id);
  const row = mine.data?.[0] as { role?: string; organisation?: { id?: string; establishment_country?: string } } | undefined;
  check(
    "the app's membership query returns the org embedded, with role owner",
    !mine.error && row?.role === "owner" && row.organisation?.id === acme && row.organisation.establishment_country === "GB",
    mine.error?.message,
  );

  // Alice: add a product with facts left unknown (src/Products.tsx AddProduct)
  const inserted = await alice.client.from("product").insert({
    organisation_id: acme, sku: "E2E-1", title: "Kettle",
    has_battery: null, is_electrical: true, is_toy: null, has_packaging: null,
  });
  check("owner can add a product", !inserted.error, inserted.error?.message);
  const listed = await alice.client.from("product").select("sku, has_battery, is_electrical").eq("organisation_id", acme);
  check(
    "unknown facts come back as null, not false",
    listed.data?.[0]?.has_battery === null && listed.data?.[0]?.is_electrical === true,
    JSON.stringify(listed.data),
  );

  // Bob: another tenant sees nothing of Acme's, and can't write into it
  const bobOrgs = await bob.client.from("organisation").select("id").eq("id", acme);
  const bobProducts = await bob.client.from("product").select("id").eq("organisation_id", acme);
  check("another user cannot see the organisation", !bobOrgs.error && bobOrgs.data?.length === 0);
  check("another user cannot see its products", !bobProducts.error && bobProducts.data?.length === 0);
  const planted = await bob.client.from("product").insert({ organisation_id: acme, sku: "PLANTED" });
  check("another user cannot insert into it", planted.error?.code === "42501", planted.error?.message ?? "insert was accepted");
  const joined = await bob.client.from("membership").insert({ organisation_id: acme, user_id: bob.id, role: "owner" });
  check("another user cannot add themselves as a member", !!joined.error, joined.error?.message ?? "insert was accepted");

  // Anonymous: nothing at all
  const anon = createClient(url, publishable, noSession);
  const anonRead = await anon.from("organisation").select("id");
  check("anonymous requests are refused outright", !!anonRead.error, anonRead.error?.message ?? `returned ${anonRead.data?.length} rows`);

  // Audit trail, as the owner
  const audit = await alice.client.from("audit_log").select("actor, action, entity").eq("organisation_id", acme).eq("entity", "product");
  check("the product insert is in the audit log with the real actor", !!audit.data?.some((a) => a.actor === alice.id && a.action === "INSERT"));

  // Magic link: the exact call src/SignIn.tsx makes, delivered to the local mail catcher
  const magic = await anon.auth.signInWithOtp({ email: `alice-${run}@e2e.test`, options: { emailRedirectTo: "http://localhost:5173" } });
  check("magic-link sign-in request is accepted", !magic.error, magic.error?.message);
  if (mailpit) {
    const messages = (await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:alice-${run}@e2e.test`)}`)).json()) as { messages_count?: number };
    check("the sign-in email reached the local mail catcher", (messages.messages_count ?? 0) > 0);
  }
} finally {
  for (const id of orgIds) await admin.from("organisation").delete().eq("id", id);
  await admin.auth.admin.deleteUser(alice.id);
  await admin.auth.admin.deleteUser(bob.id);
}

console.log(failures === 0 ? "\nAll end-to-end checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
