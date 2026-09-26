# Public scanner

A static page. A seller drops in their product spreadsheet and sees, per SKU and per market,
what applies, what is outstanding, and what we cannot decide yet.

```bash
npm run scanner:preview   # build including unreviewed drafts, banner-stamped
npm run scanner:build     # production; refuses while nothing is published
npm run -w @cfm/scanner-app serve
```

Deploy `dist/` to any static host. There is no server component and there must not be one.

## Everything runs in the browser

The spreadsheet is read with `FileReader`, evaluated against a catalog slice fetched as a
static JSON file, and rendered. Nothing is posted anywhere, so the scanner processes no
personal data and cannot be made to spend money — the two properties that let it ship in weeks
2–3 rather than waiting on the privacy artefacts in D-013.

**The build enforces this.** After bundling it greps the output for `XMLHttpRequest`,
`sendBeacon`, `WebSocket`, `EventSource`, form submissions and absolute `http(s)` URLs, and
fails if it finds any; the single permitted `fetch` must target a relative `catalog/` path. If
that behaviour ever changes deliberately, the claim comes out of `src/index.html` in the same
commit. Verified against two real violations before being trusted.

## The catalog is narrowed, not hidden

Each market gets its own slice, so a scraper enumerates markets rather than pressing save once.
That is a speed bump. Anything in a browser is extractable, and the README says so rather than
implying otherwise; the durable moat is the review discipline and the change monitoring, not
the snapshot.

A requirement is dropped from a slice only when the evaluator, given the market and nothing
else, returns a decided `false`. Anything merely undecidable stays in every slice.
`packages/catalog/test/slice.test.ts` asserts across eight markets and six fact profiles that a
slice never changes an answer — narrowing has to be invisible, or the build step becomes a
place obligations quietly disappear.

## Counting Gate-2 usage

D-021 originally planned to count scans from the static host's own request logs. In practice,
free-tier static hosts keep few or no request logs, so `05-interim-waitlist-plan.md` amends this
(D-043 §5 decision 4): `functions/catalog/[iso].ts` counts each `catalog/<ISO>.json` fetch in D1
before serving the exact same static file unchanged — no client-side tracking, and nothing about
the visitor's spreadsheet is involved (this fires before the browser has read anything). See
"Interim waitlist capture" below.

That's "≥150 scanner uses". The other half of Gate 2, "≥100 waitlist signups", is the waitlist
page — see the same section.

## Interim waitlist capture (Cloudflare)

MailerLite (D-026) is deferred until a PO box exists — its terms require a postal address in
every footer. Until then, `waitlist.html`'s form posts same-origin to `/api/subscribe`, a
Cloudflare Pages Function backed by a D1 database created with `--jurisdiction=eu`. Full design
in `../../project-setup/05-interim-waitlist-plan.md`; D-043 in `decisions.md`.

```
functions/
  api/subscribe.ts       onRequestPost  — validates, stores, redirects to waitlist-thanks.html
  api/unsubscribe.ts     onRequestGet/Post — GET shows a confirm page, POST removes
  catalog/[iso].ts       onRequestGet — counts the scan, then falls through to the static file
  lib/store.ts           D1Store implementing @cfm/waitlist's WaitlistStore
```

All the deterministic logic (email/consent/honeypot validation, the unsubscribe token) lives in
`@cfm/waitlist`, tested with no Cloudflare runtime at all. The Functions above are thin: parse
the request, call the logic, map the result to a response.

### Local development (no Cloudflare account needed)

```bash
npm run -w @cfm/scanner-app build:preview        # produces dist/
cp apps/scanner/.dev.vars.example apps/scanner/.dev.vars   # then fill in UNSUB_SECRET
cd apps/scanner
npx wrangler d1 execute cfm-waitlist --local --file=migrations/0001_init.sql
npx wrangler pages dev dist --local
```

Do **not** add `--d1=DB` to that last command — a real gotcha found while building this: `--d1
DB` creates an ad-hoc, unnamed local D1 database (separate storage from the one the migration
was just applied to), so every write 500s with "no such table". Leaving it off lets `wrangler
pages dev` read the `[[d1_databases]]` binding from `wrangler.toml` — the same named database
(`cfm-waitlist`) the migration targeted — which is what makes local dev actually work.

### Deployed status (26 September 2026)

- D1 database `cfm-waitlist` created in region **EEUR** and migrated. Empty and ready for real
  traffic (a test signup and a test scan made during verification were both deleted afterward).
- Pages project **`cfm-scanner`** created, live at `https://cfm-scanner.pages.dev` — confirmed
  against the actual deployed URL: homepage 200s, `/catalog/DE.json` serves and counts the scan
  in the real database, `/api/subscribe` stores a real signup and redirects correctly.
- **Not yet done — needs Tabeen:**
  - `npx wrangler pages secret put UNSUB_SECRET --project-name=cfm-scanner` (a long random
    value — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — never
    reuse the local `.dev.vars` one). Blocked by this session's own permission settings when
    attempted automatically; needs to be run by hand or the permission granted.
  - A **production** build and redeploy with `CONTROLLER_NAME` and `CONTACT_EMAIL` set (see
    "Building for production" below) — the live site currently only has the `--include-drafts`
    preview build up (draft banner visible, unreviewed requirements included, controller
    placeholders unfilled), which was deployed to verify the pipeline itself, not to be the
    real public page.
  - A custom domain, if wanted — `cfm-scanner.pages.dev` works today with no domain purchase.

Redeploy any time with:
```bash
npx wrangler pages deploy dist --project-name=cfm-scanner
```

### Operator scripts

Each shells out to `wrangler d1 execute --remote`, so they need Cloudflare credentials wrangler
already knows about — never printed by these scripts or anywhere else.

| Script | Does |
|---|---|
| `npm run -w @cfm/scanner-app waitlist:count` | Prints total signups and scans by market/week — the two Gate 2 numbers. |
| `npm run -w @cfm/scanner-app waitlist:export` | Writes a CSV to `apps/scanner/exports/` (gitignored) — importable into MailerLite once the PO box exists, with original consent dates preserved. |
| `npm run -w @cfm/scanner-app waitlist:delete -- <email>` | Handles an erasure request made by email or letter, rather than through the self-serve unsubscribe link. |

## Known gaps

- **GB slices to a single requirement.** Correct — no EU requirement applies there — but it
  makes the UK view nearly empty, and the UK requirement is the catalog's least worked-through
  (`confidence: low`). Worth deciding whether to offer GB at launch at all.
- **Nothing is deployed yet.** The Functions above are built and verified against a local
  `wrangler pages dev` + local D1, but no Cloudflare account has been created — see "Deploying
  for real" above.
- **Digest sending is manual** until MailerLite. See `05-interim-waitlist-plan.md` §6.

## Building for production

Four gates must pass, each verified against a real failing case before being trusted:

| Gate | Refuses when |
|---|---|
| Catalog | no requirement is published — the scanner would tell every seller they are fine |
| Slices | any offered market resolves to zero requirements |
| Privacy notice | controller name or contact email is still a placeholder (`CONTROLLER_ADDRESS` is optional — see D-043) |
| Waitlist processor | `WAITLIST_ACTION` is set but `WAITLIST_PROCESSOR` isn't `cloudflare` or `mailerlite` |
| Bundle | `app.js` contains any way to transmit the visitor's file |

Interim (Cloudflare, D-043 — see above):

```bash
CONTROLLER_NAME="…" \
CONTACT_EMAIL="…" \
WAITLIST_ACTION="/api/subscribe" \
WAITLIST_PROCESSOR="cloudflare" \
  npm run scanner:build
```

Later (MailerLite, D-026, once the PO box exists):

```bash
CONTROLLER_NAME="…" \
CONTROLLER_ADDRESS="…" \
CONTACT_EMAIL="…" \
WAITLIST_ACTION="https://assets.mailerlite.com/jsonp/<account>/forms/<form>/subscribe" \
WAITLIST_PROCESSOR="mailerlite" \
  npm run scanner:build
```

`CONTROLLER_ADDRESS` unset renders "postal address available on request" instead of failing the
build. Unset entirely, `WAITLIST_ACTION` renders the form visibly disabled rather than
discarding addresses.
