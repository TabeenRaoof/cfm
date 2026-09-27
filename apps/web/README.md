# Web app (Slice B)

The logged-in product (D-012, D-048). What's built so far:

- **Increment 1 (D-049):** magic-link sign-in, organisations, and products.
- **Increment 2 (D-050):**
  - **Readiness per product × market.** This is the same deterministic assessment the free
    scanner runs, over stored facts.
  - **CSV import.** It uses the same importer as the scanner. Blank cells never erase what's
    already known.
  - **Organisation details.** The form is generated from the facts the catalog reads.
  - **Members and invitations.**

Still to come: document upload, extraction, evidence linking, persisted assessments and
technical-file export.

## Facts: unknown is never stored as "no"

The catalog evaluates a flat bag of fact paths. An **absent key means unknown**; a **`null` means
"we know there is none"**. Storage keeps the distinction:

- **Typed columns** (`has_battery`, `manufacturer_country`, …): `NULL` = unknown. There is no
  default anywhere.
- **`product.facts` / `organisation.facts` (jsonb):** everything else. These keep "absent" and
  "null" apart exactly. A `CHECK` constraint enforces the scope: product facts on products,
  organisation and packaging facts on the organisation. It also refuses:
  - a key that duplicates a typed column
  - a key the catalog derives itself (e.g. `organisation.established_in_market`)
  - nested values

`src/domain/facts.ts` translates in both directions. `test/facts.test.ts` runs a real CSV
through `import_products` and back, and asserts the evaluator sees exactly what the importer read.
`test/readiness.test.ts` asserts the app and the free scanner give identical statuses for every
product and market from the same CSV.

Readiness is computed in the browser and never stored, so a client can't write itself a "met".
Persisted assessments come with evidence linking, computed server-side.

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

The tests were verified against real violations before being trusted. Each deliberate break
below was caught and then reverted.

In increment 1 (D-049):
- opening product reads to everyone
- removing the owner-role guard
- defaulting `has_battery` to `false`
- allowing direct membership inserts

In increment 2 (D-050):
- an import that overwrites with blanks
- an import that replaces facts instead of merging
- accepting an invitation without a confirmed email
- accepting someone else's invitation
- an import that bypasses RLS
- facts shadowing typed columns
- the app dropping stored facts

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
  whose id they know.
- **Invitations are the only way in.** Owners and admins invite an address with a role — never
  the owner role. `invited_by` and `expires_at` (14 days) come from defaults and can't be set by
  the client. The invitee accepts by signing in with that address, and acceptance requires a
  confirmed email. An invitation can't be accepted by someone else, after it expires, or to
  change an existing member's role.
- **`import_products` is all-or-nothing.** It runs with the caller's rights, so RLS decides who
  can import. A blank cell can't erase a known value (`COALESCE` / jsonb `||`), a repeated SKU or
  more than 5,000 rows refuses the whole file, and a single bad value rolls back everything.
- Organisations can't be deleted from the app. Deletion is D-013's written procedure.
- The yes/no product facts have no default. `NULL` means unknown, the catalog's hard rule, and
  the UI's selects start at "Unknown" for the same reason.
- `audit_log` records every change to organisations, memberships, products and invitations, with
  the actor.
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
