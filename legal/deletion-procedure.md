# Deletion procedure

**Status:** draft, 27 September 2026 (D-053). Internal runbook — written for whoever operates the
service, today Tabeen. It is the "written deletion procedure, even if manual" that D-013 requires
before the first real upload, and the process behind the privacy policy's and DPA's deletion
promises (`/privacy` "How long we keep it", `/dpa` §8).

> **Blocked:** step 5 cannot be done today. The change history (`audit_log`) keeps full copies of
> every changed row and refuses deletion, even by the service role. Until the fix in
> [§ The audit-log blocker](#the-audit-log-blocker) lands, an organisation cannot be fully erased,
> so uploads stay off and the legal pages stay marked draft.

Never keep a request register, export or query result containing personal data in this
repository. The register lives in the contact mailbox (a labelled thread per request).

---

## A. Closing an organisation (all its data)

Deadline: **30 days from the request** (DPA §8). Aim for 7.

1. **Record the request.** Label the email thread `deletion/<organisation id>`; note the date
   received. That thread is the register.
2. **Verify the requester is an owner.** In the Supabase dashboard (project `qsqhcithnqanqzvsfyez`,
   SQL editor):

   ```sql
   select o.id, o.name, u.email, m.role
   from public.organisation o
   join public.membership m on m.organisation_id = o.id
   join auth.users u on u.id = m.user_id
   where o.id = '<organisation id>';
   ```

   The request must come from, or be confirmed by a reply from, an address listed as `owner`.
   Anyone else: decline, and tell the owners.
3. **Offer the export, then wait for a yes or 7 days.** In the app, owners can download each
   SKU's technical file (Readiness) and each original document (Documents). If they want the
   raw records too, run the queries in [Export queries](#export-queries) and send the result
   to the owner's address only, as an attachment, then delete your local copy.
4. **Delete the stored files first** (while the database still says where they are):

   ```sql
   select storage_key from public.document where organisation_id = '<organisation id>';
   ```

   For each key, from `apps/web/`:

   ```sh
   npx wrangler r2 object delete "cfm-documents/<storage_key>" --remote --jurisdiction eu
   ```

   Then confirm in the Cloudflare dashboard (R2 → `cfm-documents`, EU jurisdiction) that no
   object remains under the `<organisation id>/` prefix. Upload failures delete their own object
   (`worker/routes.ts`), so the prefix should be empty; if anything remains, delete it too.
5. **Delete the change history.** ⚠ *Blocked — see below.*
6. **Delete the organisation.**

   ```sql
   delete from public.organisation where id = '<organisation id>';
   ```

   This cascades to memberships, products, invitations, documents, extractions and
   document–product links (`supabase/migrations/`). Check with
   `select count(*) from public.<table> where organisation_id = '<organisation id>'` for each
   table: all zero.
7. **Delete accounts that belonged only to this organisation**, if the owner asked for account
   closure too: Supabase dashboard → Authentication → Users → delete each user with no remaining
   membership. An account that belongs to another organisation stays.
8. **What expires on its own:** anything sent to Anthropic (within 30 days); provider backups
   (none on Supabase's free plan; 7 days on Pro). Nothing to do — but do not promise faster.
9. **Confirm in writing** to the owner's address: what was deleted, on which date, and the two
   expiries in step 8. Note the completion date on the thread.

## B. A single person's data inside an organisation

Someone named in a document (a responsible person, a supplier's contact) is the organisation's
data subject, not ours (DPA §9).

1. Forward the request to the organisation's owners within 2 working days; tell the person you
   have done so. Do not delete on the person's word alone — the organisation decides.
2. If the organisation instructs deletion: an owner or admin deletes the document in the app
   (removes the file from storage immediately and the record), and edits any product facts
   that name the person.
3. ⚠ The change history still holds copies — same blocker as A.5.

## C. Closing one user's account

1. Verify from the account's own email address.
2. If they are the only owner of an organisation, they must hand ownership to someone else or
   close the organisation (A) first. The app refuses to let the last owner leave, but deleting
   the user from the dashboard would not — the owner guard only applies to signed-in users —
   and would strand the organisation ownerless. Run step A.2's query first.
3. They leave each organisation (Members → leave), then delete the user in the dashboard
   (Authentication → Users). `invited_by`, `uploaded_by`, `reviewed_by` and `created_by` become
   empty; the organisation's data stays, because it is the organisation's.
4. ⚠ Their email address remains in the change history's copies of invitations — same blocker.

---

## The audit-log blocker

**What:** `private.audit()` (`20260926000001_tenancy.sql`) writes `to_jsonb(old)` and
`to_jsonb(new)` for every change — organisation names, product facts including responsible
persons' names and addresses, invitation emails, document filenames and extracted fields. Its
append-only trigger refuses update, delete and truncate for every role, including the service
role. So the personal data outlives the organisation, forever.

**It also contradicts D-005**, which decided the audit log holds "events and hashes, never
content". The implementation drifted from the decision.

**Options (Tabeen's decision):**

1. **Bring the audit log in line with D-005 (recommended).** The trigger records who, when,
   which entity, which action and *which columns changed* — no values. A one-off migration strips
   `before`/`after` from existing rows (the database has no customers yet, so nothing of value is
   lost) and visibly re-creates the append-only trigger. What remains after an organisation is
   deleted is UUIDs and timestamps: no longer linkable to anyone once the organisation and its
   accounts are gone, so the log can stay append-only and step A.5 disappears. Cost: the history
   shows *that* a fact changed, not *from what to what*.
2. **Keep full snapshots, add a service-role-only purge.** A function that deletes one
   organisation's audit rows, allowed through the append-only trigger by a transaction-local
   flag only it can set. Keeps rich history while an organisation exists, but B and C (erasing
   one person inside a living organisation) would need per-row redaction as well — more code,
   more ways to get it wrong, and it weakens "append-only".

Either way the fix is a new migration plus a test that proves erasure on a real row.

---

## Export queries

Run in the SQL editor; replace the id. Each returns one JSON document.

```sql
select jsonb_build_object(
  'organisation', (select to_jsonb(o) from public.organisation o where o.id = '<id>'),
  'products', (select coalesce(jsonb_agg(p), '[]') from public.product p where p.organisation_id = '<id>'),
  'documents', (select coalesce(jsonb_agg(d), '[]') from public.document d where d.organisation_id = '<id>'),
  'extractions', (select coalesce(jsonb_agg(e), '[]') from public.extraction e where e.organisation_id = '<id>'),
  'document_products', (select coalesce(jsonb_agg(l), '[]') from public.document_product l where l.organisation_id = '<id>')
);
```
