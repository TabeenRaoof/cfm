/**
 * End-to-end check of the document path (D-051), locally: the real Worker (`wrangler dev`, with
 * local R2 and a local Queue), the real migrations on a local Supabase stack, and a fake AI provider
 * (worker/index.e2e.ts) — no API key, no spend. Makes the same requests the Documents screen makes.
 *
 *   cd apps/web && npx supabase start && npx supabase db reset
 *   npm run -w @cfm/web e2e:worker
 *
 * Local-only by construction: refuses any Supabase URL that isn't localhost, and uses
 * wrangler.e2e.toml, which points at the fake-provider entry. Keys come from `supabase status` and
 * are never printed.
 */

import { spawn, execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assessProduct } from "@cfm/catalog";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { catalog } from "../src/domain/catalog.ts";
import { proposeFacts } from "../src/domain/document-facts.ts";
import { evidenceByProduct, type DocumentRow, type ExtractionRow } from "../src/domain/evidence.ts";
import { subjectFacts, type ProductRow } from "../src/domain/facts.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8796;
const BASE = `http://127.0.0.1:${PORT}`;

const status = Object.fromEntries(
  execFileSync("npx", ["supabase", "status", "-o", "env"], { cwd: appRoot, encoding: "utf8" })
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
) as Record<string, string | undefined>;
const url = status.API_URL!;
const publishable = (status.PUBLISHABLE_KEY ?? status.ANON_KEY)!;
const secret = (status.SECRET_KEY ?? status.SERVICE_ROLE_KEY)!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url ?? "")) throw new Error(`Refusing non-local Supabase URL: ${url}`);

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ---- Start the Worker ----------------------------------------------------------------------------
execFileSync("npx", ["vite", "build", "--mode", "preview", "--logLevel", "error"], { cwd: appRoot, stdio: "inherit" });
const worker = spawn(
  "npx",
  ["wrangler", "dev", "-c", "wrangler.e2e.toml", "--port", String(PORT), "--local",
    "--var", `SUPABASE_PUBLISHABLE_KEY:${publishable}`, "--var", `SUPABASE_SECRET_KEY:${secret}`],
  { cwd: appRoot, stdio: ["ignore", "pipe", "pipe"] },
);
let workerLog = "";
worker.stdout.on("data", (d) => (workerLog += String(d)));
worker.stderr.on("data", (d) => (workerLog += String(d)));

async function waitFor<T>(what: string, probe: () => Promise<T | undefined>, timeoutMs = 45_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const password = `e2e-${run}-Pw!`;
const userIds: string[] = [];
const orgIds: string[] = [];

async function signedIn(name: string): Promise<{ client: SupabaseClient; id: string; token: string; email: string }> {
  const email = `${name}-${run}@e2e.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { client, id: created.data.user.id, token: session.data.session.access_token, email };
}

async function mandatePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  [
    "MANDATE OF APPOINTMENT",
    `Nordholt Trading GmbH ${run}, Speicherstrasse 12, 20457 Hamburg, Germany, hereby appoints`,
    "Compliance Bridge BV, Keizersgracht 1, 1015 Amsterdam, Netherlands, as its responsible person",
    "under Regulation (EU) 2023/988. Contact: rp@bridge.example",
    "Signed on: 03.02.2026",
  ].forEach((line, i) => page.drawText(line, { x: 40, y: 760 - i * 18, size: 10, font }));
  return doc.save();
}

async function upload(token: string, organisationId: string, bytes: Uint8Array, name: string, docType: string, productIds: string[] = []) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name));
  form.set("organisation_id", organisationId);
  form.set("doc_type", docType);
  for (const id of productIds) form.append("product_id", id);
  const response = await fetch(`${BASE}/api/documents`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as { documentId?: string; error?: string } };
}

const docStatus = async (client: SupabaseClient, id: string) =>
  ((await client.from("document").select("status").eq("id", id).maybeSingle()).data?.status as string | undefined);

try {
  await waitFor("the Worker to start", async () => ((await fetch(`${BASE}/api/documents`)).status === 401 ? true : undefined));
  check("Worker is up, and /api refuses an unauthenticated request", true);

  const owner = await signedIn("owner");
  const viewer = await signedIn("viewer");
  const outsider = await signedIn("outsider");

  const org = (await owner.client.rpc("create_organisation", { p_name: `E2E Docs ${run}`, p_establishment_country: "GB" })).data as string;
  orgIds.push(org);
  await owner.client.from("invitation").insert({ organisation_id: org, email: viewer.email, role: "viewer" });
  const invitation = ((await viewer.client.rpc("my_invitations")).data as { id: string }[])[0]!;
  await viewer.client.rpc("accept_invitation", { p_invitation_id: invitation.id });
  const product = (await owner.client.from("product").insert({
    organisation_id: org, sku: "E2E-KETTLE", title: "Kettle", gtin: "4006381333931",
    has_battery: false, is_electrical: true, is_toy: false, has_packaging: true, manufacturer_country: "CN",
  }).select("id").single()).data!.id as string;

  // --- The main path: upload → R2 → queue → extraction → accepted --------------------------------
  const pdf = await mandatePdf();
  const uploaded = await upload(owner.token, org, pdf, "mandate.pdf", "rp_mandate", [product]);
  check("owner uploads a mandate linked to a product → 201", uploaded.status === 201 && !!uploaded.body.documentId, JSON.stringify(uploaded.body));
  const docId = uploaded.body.documentId!;

  const finalStatus = await waitFor("the queue to process the document", async () => {
    const s = await docStatus(owner.client, docId);
    return s && s !== "queued" && s !== "processing" ? s : undefined;
  });
  check("the queue consumer read it, and the gate accepted it", finalStatus === "accepted", finalStatus);

  const extraction = (await owner.client.from("extraction").select("decision, source, used_model, provider, verdict").eq("document_id", docId).single()).data as
    { decision: string; source: string; used_model: boolean; provider: string; verdict: { fields: { key: string; value: unknown; source: string }[] } };
  const issueDate = extraction.verdict.fields.find((f) => f.key === "issue_date");
  check("extraction stored by the pipeline, model used only for what the patterns didn't find",
    extraction.source === "pipeline" && extraction.used_model && extraction.provider === "fake-e2e" && issueDate?.source === "pattern" && issueDate.value === "2026-02-03",
    JSON.stringify({ source: extraction.source, provider: extraction.provider, issueDate }));

  const audit = (await owner.client.from("audit_log").select("actor").eq("entity", "document").eq("entity_id", docId).eq("action", "INSERT")).data as { actor: string }[];
  check("the audit log names the real uploader, not 'the system'", audit[0]?.actor === owner.id);

  // --- Download ---------------------------------------------------------------------------------
  const download = await fetch(`${BASE}/api/documents/${docId}/file`, { headers: { Authorization: `Bearer ${owner.token}` } });
  const downloaded = new Uint8Array(await download.arrayBuffer());
  check("owner downloads the original, byte for byte", download.status === 200 && downloaded.length === pdf.length && downloaded.every((b, i) => b === pdf[i]));
  const outsiderDownload = await fetch(`${BASE}/api/documents/${docId}/file`, { headers: { Authorization: `Bearer ${outsider.token}` } });
  check("an outsider can't download it (404, not even confirmation it exists)", outsiderDownload.status === 404);

  // --- Refusals ----------------------------------------------------------------------------------
  check("uploading the same file again → 409", (await upload(owner.token, org, pdf, "again.pdf", "rp_mandate")).status === 409);
  check("a viewer can't upload → 403", (await upload(viewer.token, org, pdf, "v.pdf", "rp_mandate")).status === 403);
  check("an outsider can't upload into the org → 403", (await upload(outsider.token, org, pdf, "o.pdf", "rp_mandate")).status === 403);
  check("a script renamed .pdf is refused by its bytes → 415",
    (await upload(owner.token, org, new TextEncoder().encode("<script>alert(1)</script>"), "evil.pdf", "rp_mandate")).status === 415);
  check("an unknown document type → 400", (await upload(owner.token, org, pdf, "x.pdf", "test_report")).status === 400);

  // --- Human review for a document the pipeline couldn't read ------------------------------------
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, run.length]);
  const photo = await upload(owner.token, org, png, "photo.png", "rp_mandate");
  const photoId = photo.body.documentId!;
  const photoStatus = await waitFor("the photo to be processed", async () => {
    const s = await docStatus(owner.client, photoId);
    return s && s !== "queued" && s !== "processing" ? s : undefined;
  });
  check("a photo the model can't read goes to review, not acceptance", photoStatus === "needs_review", photoStatus);

  const review = (values: object, token = owner.token) =>
    fetch(`${BASE}/api/documents/${photoId}/review`, {
      method: "POST", body: JSON.stringify({ values }), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  const values = { rp_name: "Compliance Bridge BV", rp_address: "Keizersgracht 1, Amsterdam", rp_country: "NL", manufacturer_name: "Nordholt", issue_date: "2026-02-03" };
  check("a viewer can't review → 403", (await review(values, viewer.token)).status === 403);
  check("an impossible date is refused by the same validators → 422", (await review({ ...values, issue_date: "2026-02-30" })).status === 422);
  check("a complete, valid review is accepted → 200", (await review(values)).status === 200);
  const human = (await owner.client.from("extraction").select("source, reviewed_by").eq("document_id", photoId).eq("source", "human").single()).data as { reviewed_by: string };
  check("the review is stored as human-sourced, under the reviewer", human?.reviewed_by === owner.id);

  // --- Red → green, through the same modules the screens use -------------------------------------
  const [docs, extractions, links, productRow] = await Promise.all([
    owner.client.from("document").select("id, organisation_id, doc_type, filename, mime, byte_size, status, error, created_at").eq("organisation_id", org),
    owner.client.from("extraction").select("id, document_id, decision, verdict, source, reviewed_by, used_model, created_at").eq("organisation_id", org),
    owner.client.from("document_product").select("document_id, product_id").eq("organisation_id", org),
    owner.client.from("product").select("sku, title, brand, category_code, gtin, has_battery, is_electrical, is_toy, has_packaging, manufacturer_country, facts").eq("id", product).single(),
  ]);
  const evidence = evidenceByProduct([product], docs.data as DocumentRow[], extractions.data as ExtractionRow[], links.data as { document_id: string; product_id: string }[], catalog);
  const statusNow = (facts: ProductRow["facts"]) =>
    assessProduct(catalog, { facts: subjectFacts({ establishment_country: "GB", facts: {} }, { ...(productRow.data as ProductRow), facts }), market: { iso_country: "DE" } },
      { asOf: new Date().toISOString().slice(0, 10), evidence: evidence.get(product)!.view })
      .assessments.find((a) => a.requirement_id === "eu.gpsr.responsible-economic-operator")?.status;
  check("before applying the mandate's details: not met", statusNow({}) !== "met", String(statusNow({})));

  const mandateVerdict = (extractions.data as ExtractionRow[]).find((e) => e.document_id === docId)!.verdict;
  const facts = Object.fromEntries(proposeFacts("rp_mandate", mandateVerdict, catalog).map((p) => [p.path, p.value]));
  const applied = await owner.client.from("product").update({ facts }).eq("id", product);
  check("owner applies the mandate's details to the product", !applied.error, applied.error?.message);
  check("RED → GREEN: the EU responsible-person requirement is now met in Germany", statusNow(facts) === "met", String(statusNow(facts)));

  // --- Invitations: with self-signup off, inviting is what creates the account (D-057) -----------
  const invite = (token: string, email: string, role = "member") =>
    fetch(`${BASE}/api/invitations`, {
      method: "POST", body: JSON.stringify({ organisation_id: org, email, role }),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  const newcomer = `newcomer-${run}@e2e.test`;
  const invited = await invite(owner.token, newcomer.toUpperCase());
  const invitedBody = (await invited.json()) as { account?: string };
  check("owner invites a new address → 201, account created", invited.status === 201 && invitedBody.account === "created", JSON.stringify(invitedBody));
  const accounts = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users;
  const provisioned = accounts.find((u) => u.email === newcomer);
  if (provisioned) userIds.push(provisioned.id);
  check("…stored lowercased, and confirmed so a sign-in link can reach it", !!provisioned?.email_confirmed_at);
  const anon = createClient(url, publishable, { auth: { persistSession: false } });
  const newcomerLink = await anon.auth.signInWithOtp({ email: newcomer, options: { shouldCreateUser: false } });
  check("the invitee can request a sign-in link", !newcomerLink.error, newcomerLink.error?.message);
  check("inviting the same address again → 409", (await invite(owner.token, newcomer)).status === 409);
  const existing = await invite(owner.token, outsider.email, "viewer");
  check("inviting someone who already has an account → 201, no second account",
    existing.status === 201 && ((await existing.json()) as { account?: string }).account === "existing");
  check("a viewer can't invite → 403", (await invite(viewer.token, `v-${run}@e2e.test`)).status === 403);
  check("an outsider can't invite into the org → 403", (await invite(outsider.token, `o-${run}@e2e.test`)).status === 403);
  check("nobody can invite an owner → 400", (await invite(owner.token, `x-${run}@e2e.test`, "owner")).status === 400);
  const refusedAccounts = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.filter((u) => [`v-${run}@e2e.test`, `o-${run}@e2e.test`, `x-${run}@e2e.test`].includes(u.email ?? ""));
  check("…and a refused invitation creates no account", refusedAccounts.length === 0, refusedAccounts.map((u) => u.email).join());

  // --- Delete --------------------------------------------------------------------------------------
  const del = (token: string) => fetch(`${BASE}/api/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  check("a viewer can't delete → 403", (await del(viewer.token)).status === 403);
  check("the owner deletes it → 204", (await del(owner.token)).status === 204);
  check("…and the file is gone", (await fetch(`${BASE}/api/documents/${docId}/file`, { headers: { Authorization: `Bearer ${owner.token}` } })).status === 404);
  const deletedBy = (await owner.client.from("audit_log").select("actor").eq("entity", "document").eq("entity_id", docId).eq("action", "DELETE")).data as { actor: string }[];
  check("the audit log names who deleted it", deletedBy[0]?.actor === owner.id);
} catch (error) {
  failures++;
  console.log(`✗ ${error instanceof Error ? error.message : String(error)}`);
  console.log(workerLog.split("\n").slice(-25).join("\n").replace(/sb_secret_\S+|eyJ\S+/g, "[redacted]"));
} finally {
  for (const id of orgIds) await admin.from("organisation").delete().eq("id", id);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  worker.kill("SIGTERM");
}

console.log(failures === 0 ? "\nAll document end-to-end checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
