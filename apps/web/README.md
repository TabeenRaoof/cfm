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
- **Increment 3 (D-051):**
  - **Documents.** Upload an RP mandate or EPR certificate. It's read automatically
    (deterministic first, then the model only for what's left) and accepted by the gate or sent
    back for review.
  - **Evidence.** Accepted documents count toward readiness, scoped to the right market.
  - **Use these details.** A document's stated details can be applied as facts.
  - **Technical file** per product and market.

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

Readiness is computed in the browser and never stored. What can make a cell "met" — documents
and extractions — lives in rows no client can write (D-051).

## Architecture

- **One Cloudflare Worker** (`wrangler.toml`, `worker/`) serves three things:
  - the built SPA, as static assets
  - the `/api` routes: upload, download, review, delete
  - the document queue's consumer

  It's a Worker rather than a Pages project because Pages can't consume a Queue (D-051).
- **Supabase** provides Postgres (EU region), Auth and row-level security. The browser reads and
  writes its own organisation's data directly with the publishable key, under RLS.
- **The Worker is the only writer of documents and extractions.** It verifies the caller's session,
  reads as the caller under RLS, and writes through four service-role-only functions. Those
  re-check the caller's role in the database and record them as the audit actor.
- **Originals live in R2** under `organisation/sha256`, in an EU-jurisdiction bucket.

## Documents (D-051)

`worker/process.ts` is the pipeline. It's written against small interfaces, so it's tested
without Cloudflare, Supabase or a paid model (`test/process.test.ts`). Steps:

1. Take the document type from the uploader; there's no classification call.
2. Read the PDF's text layer locally with unpdf.
3. Let `@cfm/documents`' patterns answer what they can.
4. Ask the model (`@cfm/ai`'s `extract_document`) only for the remaining fields, inside the
   task's token budget. A scan goes as the PDF itself, priced per page, so a long one is refused
   before anything is sent.
5. Let `gateExtraction` decide accept or review. The model never judges its own output.

A human review goes through the same validators and gate.

Guards:
- Uploads are refused unless `UPLOADS_ENABLED=true`. That's D-013's gate: no real document before
  its privacy paperwork.
- Per-document spend is capped at $0.10 by the adapter.
- The deployable entry (`worker/index.ts`) can't import the fake provider
  (`test/worker-boundary.test.ts`). Only `worker/index.e2e.ts` does, for local runs.

`npm run -w @cfm/web e2e:worker` (24 checks) runs the real Worker locally with `wrangler dev`,
local R2 and a local Queue, against local Supabase and a fake provider. It covers upload, queue,
extraction, audit actors, download, every refusal, human review, and a requirement going from
"partial" to "met" through the same code the screens use.

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
3. Create the storage bucket and queues:
   - `npx wrangler r2 bucket create cfm-documents --jurisdiction=eu`
   - `npx wrangler queues create cfm-documents`
4. Set the Worker's secrets: `npx wrangler secret put SUPABASE_SECRET_KEY` and
   `npx wrangler secret put ANTHROPIC_API_KEY`.
5. Fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `wrangler.toml`.
6. Build with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then run
   `npx wrangler deploy`.
4. **Before any design partner uploads a real document** (D-013): customer DPA, design-partner
   agreement, written deletion procedure, and signed DPAs with Supabase, Cloudflare and
   Anthropic.
