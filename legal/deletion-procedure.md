# Deletion procedure

**Status:** draft, 27 September 2026 (D-053). Internal runbook — written for whoever operates the
service, today Tabeen. It is the "written deletion procedure, even if manual" that D-013 requires
before the first real upload, and the process behind the privacy policy's and DPA's deletion
promises (`/privacy` "How long we keep it", `/dpa` §8).

Organisation erasure is one database function, `public.erase_organisation` (D-054), which only
the service role can run. It deletes the organisation, everything belonging to it and its change
history, and leaves a tombstone with no content. **It must be applied to the live database
(`supabase db push`) before this procedure can be followed.**

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
4. **Delete the stored files** (while the database still says where they are):

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
5. **Erase the organisation and its history.**

   ```sql
   select public.erase_organisation('<organisation id>');
   ```

   One transaction: the organisation and everything cascading from it (memberships, products,
   invitations, documents, extractions, document–product links), then every change-history row
   about it, then a single tombstone row (`entity = 'erasure'`, no content). It returns the
   storage keys it found — each should already be gone from step 4; delete any that are not.
   Check: `select entity, before, after from public.audit_log where organisation_id =
   '<organisation id>'` returns exactly the tombstone.
6. **Delete accounts that belonged only to this organisation**, if the owner asked for account
   closure too: Supabase dashboard → Authentication → Users → delete each user with no remaining
   membership. An account that belongs to another organisation stays.
7. **What expires on its own:** anything sent to Anthropic (within 30 days); provider backups
   (none on Supabase's free plan; 7 days on Pro). Nothing to do — but do not promise faster.
8. **Confirm in writing** to the owner's address: what was deleted, on which date, and the two
   expiries in step 7. Note the completion date on the thread.

## B. A single person's data inside an organisation

Someone named in a document (a responsible person, a supplier's contact) is the organisation's
data subject, not ours (DPA §9).

1. Forward the request to the organisation's owners within 2 working days; tell the person you
   have done so. Do not delete on the person's word alone — the organisation decides.
2. If the organisation instructs deletion: an owner or admin deletes the document in the app
   (removes the file from storage immediately and the record), and edits any product facts
   that name the person.
3. ⚠ **Known limit:** the change history still holds copies of the document's fields and the
   old product facts until the organisation itself is erased. Tell the organisation so, in
   writing. Per-person erasure inside a living organisation is not built (D-054).

## C. Closing one user's account

1. Verify from the account's own email address.
2. If they are the only owner of an organisation, they must hand ownership to someone else or
   close the organisation (A) first. The app refuses to let the last owner leave, but deleting
   the user from the dashboard would not — the owner guard only applies to signed-in users —
   and would strand the organisation ownerless. Run step A.2's query first.
3. They leave each organisation (Members → leave), then delete the user in the dashboard
   (Authentication → Users). `invited_by`, `uploaded_by`, `reviewed_by` and `created_by` become
   empty; the organisation's data stays, because it is the organisation's.
4. ⚠ **Known limit:** their email address remains in the change history's copies of invitations
   until the organisation is erased (D-054).

## D. Accounts left by invitations nobody accepted (monthly)

Self-signup is off (D-057), so an invitation creates the invitee's account up front (D-058). The
privacy policy promises an account from an invitation that was never accepted is deleted once the
invitation expires. Once a month, in the SQL editor:

```sql
select u.id, u.email, u.created_at, u.last_sign_in_at
from auth.users u
where u.created_at < now() - interval '14 days'
  and not exists (select 1 from public.membership m where m.user_id = u.id)
  and not exists (select 1 from public.invitation i
                  where i.email = lower(u.email) and i.expires_at > now());
```

Each row is an account with no organisation and no live invitation. Delete it in the dashboard
(Authentication → Users). **Except** an account you provisioned yourself for a design partner who
hasn't created their organisation yet (`scripts/provision-account.ts`) — it matches too; keep it
while they're still onboarding, and check with them before deleting.

---

## The audit-log decision (D-054)

**Was:** `private.audit()` writes full `before`/`after` copies of every change, and the log refused
deletion by every role — so an organisation's personal data outlived it, forever.

**Decided (Tabeen, PR #14 review):** keep the log append-only for everyone while an organisation
exists, and let one service-role function erase a whole organisation, history included, on
offboarding or request. The append-only trigger allows exactly one kind of delete: rows of an
organisation that no longer exists, inside `erase_organisation`. `apps/web/test/erasure.test.ts`
proves it: personal data put through the history is gone afterwards; another organisation is
untouched; a living organisation's history still can't be deleted, updated or truncated, even by
the database owner with the erasure flag set.

**Still open:** erasing one person's data inside a living organisation (B and C above). Their
details stay in the history until the organisation is erased.

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
