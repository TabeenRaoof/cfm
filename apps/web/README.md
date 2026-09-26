# Web app (Slice B)

The logged-in product (D-012, D-048): organisations, products, and — in the increments that
follow — document upload, extraction, evidence linking, assessments and technical-file export.

- React single-page app built with Vite, deployed to Cloudflare Pages.
- Supabase for Postgres (EU region), Auth and row-level security. The browser talks to Supabase
  directly with the publishable key. Row-level security is what limits every read and write to
  the user's own organisations.
- Server-only work (extraction through `@cfm/ai`, upload signing) will go in Pages Functions and
  Cloudflare Queues. It isn't in this increment yet.

```bash
npm run -w @cfm/web dev            # needs apps/web/.env.local — see .env.example
npm run -w @cfm/web build          # production; refuses without Supabase settings
npm run -w @cfm/web build:preview  # renders "not configured" when settings are missing
npm run -w @cfm/web typecheck
```

## Tenant isolation is tested against the real SQL

`supabase/migrations/` is the schema. `test/rls.test.ts` runs those exact files on an in-process
Postgres 17 (PGlite, the same major version Supabase uses). It then acts as individual users —
owner, admin, member, viewer, outsider, anonymous — and asserts what the database refuses. This
proves what the database enforces, not just what the UI happens not to ask for. It runs in
`npm test` and in CI, with no Docker and no Supabase account.

The tests were verified against real violations before being trusted. Four deliberate breaks
were each caught and then reverted (D-049):

- opening product reads to everyone
- removing the owner-role guard
- defaulting `has_battery` to `false`
- allowing direct membership inserts

What the schema guarantees:

- Every table revokes Supabase's default `anon` grants. Anonymous visitors can read nothing.
- An organisation's rows are invisible to non-members, even when queried by id.
- `organisation_id` and `user_id` can't be updated. Access is granted column by column, so a row
  can't be moved between organisations.
- Roles:
  - viewers can read
  - members can add and edit products
  - owners and admins can edit the organisation
  - only owners can grant, change or remove the owner role
  - an organisation always keeps at least one owner
- Memberships can't be inserted from the client, so nobody can add themselves to an organisation
  whose id they know. Members will join through an invitation function in the next increment.
- Organisations can't be deleted from the app. Deletion is D-013's written procedure.
- The yes/no product facts have no default. `NULL` means unknown, the catalog's hard rule, and
  the UI's selects start at "Unknown" for the same reason.
- `audit_log` records every change to organisations, memberships and products, with the actor.
  Only owners and admins of that organisation can read it. It's append-only even for the
  database owner: update, delete and truncate are all refused by a trigger.

## Build gate

Every build fails if the bundle contains anything shaped like an Anthropic key or a Supabase
secret or service-role key. Anything `VITE_`-prefixed ships to every visitor. This was verified
by injecting a synthetic key and watching the build refuse.

## Before the first real user

1. **Tabeen:**
   - buy the neutral domain (D-048 §4)
   - `npx supabase login`
   - create the project in an EU region
   - set Auth's site URL and redirect URLs to the app's domain
   - configure custom SMTP (Resend) on that domain; Supabase's built-in email is rate-limited
     and for development only
2. `npx supabase link --project-ref <ref>`, then `npx supabase db push`, to apply the migrations.
3. Build with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and deploy to a Pages
   project.
4. **Before any design partner uploads a real document** (D-013): customer DPA, design-partner
   agreement, written deletion procedure, and signed DPAs with Supabase, Cloudflare and
   Anthropic.
