# 05 · Interim waitlist capture and go-live plan

**Status:** Plan, not implemented · **Written:** 25 September 2026 · **Decision:** D-043
**For:** Tabeen, and whichever model/session implements this. Read D-020, D-021, D-024, D-026,
D-027 first. They are the constraints this plan works inside.

## 1. Goal

The goal is to prove traction by putting the scanner live and getting real sellers to use it,
without MailerLite and without publishing a postal address. MailerLite waits until Tabeen buys a
PO box, because MailerLite's terms require a postal address in every email footer. The list moves
to MailerLite then, with nothing lost.

Two numbers come out of this, and both feed Gate 2 (`01-` §10, by 15 November: "≥150 scanner
uses or ≥100 waitlist signups"):

1. **Scans per market.** Counted exactly, with no client-side telemetry.
2. **Waitlist signups.** Stored with evidence of consent, so they can be imported into
   MailerLite later without asking people to sign up again.

The `01-` §7.4 funnel table also targets 100 waitlist signups by 5 October. That is a planning
assumption, not a gate. Nothing below depends on meeting it.

## 2. What exists today (verified 25 September)

- `apps/scanner` builds a static site with `index.html` (the scanner), `waitlist.html` and
  `privacy.html`. The catalog has 27 published requirements, so `npm run scanner:build` (the
  production build) can now pass its "no published catalog" gate.
- `waitlist.html` is a plain HTML form with no JavaScript. It posts to `WAITLIST_ACTION` and
  renders disabled when that is unset (D-024). Its fields are `email`, `sku_count` (optional) and
  `consent` (required checkbox).
- `privacy.html` names MailerLite as the processor. `build.ts` refuses a production build while
  `CONTROLLER_NAME`, `CONTROLLER_ADDRESS` or `CONTACT_EMAIL` is unset.
- **Nothing is deployed.** D-020 says "a static host" but no host was ever chosen.
- **Uncommitted UI edits exist.** `apps/scanner/src/{index,privacy,waitlist}.html` and
  `styles.css` have uncommitted restyling (site header and nav). They were not made by this plan.
  Commit or branch them before starting. Do not overwrite them.

## 3. Recommended architecture

**Cloudflare Pages** hosts the static `dist/`. The same deployment runs **Pages Functions** as
the only server code. Storage is **Cloudflare D1** created with `--jurisdiction=eu`.

- D1 EU jurisdiction was verified on Cloudflare's docs on 25 September. The setting is applied at
  creation and cannot be changed afterwards, so create the database with it or recreate it.
- Cloudflare is already on `02-` §2's vendor DPA list, so this adds no new processor.
- The free tier covers this scale by a wide margin. Recheck the current Workers, Pages and D1
  free limits on Cloudflare's own pricing pages at implementation time (playbook Lesson 33).
- It launches on a free `*.pages.dev` subdomain, which avoids blocking on the name (Q-6b, due
  30 September). A custom domain can be added later, and the `pages.dev` URL keeps working, so
  links already posted in forums don't break.

Alternatives considered:

- **Netlify with Netlify Forms.** No code at all, but submissions are stored in the US, the free
  tier allows 100 submissions a month, and scan counts would need raw logs that the free tier
  doesn't expose.
- **Google Forms.** Rejected. A compliance product collecting EU addresses through a Google-branded
  form undermines itself.
- **Supabase.** Rejected for now. It pulls app infrastructure forward, which D-020 set out to
  avoid.

### 3.1 Endpoints (Pages Functions)

All of these are same-origin, so the form's `action` is the relative path `/api/subscribe`.

| Route | Does |
|---|---|
| `POST /api/subscribe` | Validates the submission, inserts or ignores it, then returns a 303 redirect to `/waitlist-thanks.html`. |
| `GET /api/unsubscribe?t=<token>` | Shows a confirmation page with a single button. Doesn't act on its own, because mail scanners prefetch links. |
| `POST /api/unsubscribe` | Deletes the subscriber row, then returns a 303 redirect to `/unsubscribed.html`. |
| `GET /catalog/:iso.json` | Increments `scan_counts(iso, day)` and serves the static slice unchanged. This proposes changing D-021 (see §5, decision 4). |

### 3.2 `POST /api/subscribe` rules

Every rule here is deterministic. None of this involves a model.

- Accept POST only, with a form-encoded body under 4 KB.
- **Consent is checked on the server.** A missing `consent` value is rejected, because the
  browser's `required` attribute is not a guarantee.
- The email is trimmed and lowercased, capped at 254 characters, and checked with a simple
  syntactic test. No MX lookup.
- `sku_count` is optional free text capped at 20 characters. It is stored as text and never
  coerced into a number.
- Add a hidden **honeypot** field (e.g. `company_website`). A filled honeypot gets the same success
  redirect, and nothing is stored. The page stays free of JavaScript, so Turnstile is ruled out.
- **Idempotent, with no enumeration.** Signing up with an address already on the list returns the
  same success page. `email` has a UNIQUE constraint and the insert uses `INSERT … ON CONFLICT DO
  NOTHING`.
- **Stored per row:** `email`, `sku_count`, `consented_at` (ISO UTC), `consent_text_version`
  (hash or version tag of the checkbox wording actually shown), `source` (`waitlist`),
  `unsub_token_hash`.
- **Not stored:** IP address, user agent, or anything else. This is data minimisation, and it
  matches the privacy notice's claims.
- **Unsubscribe tokens.** Generate a random token and store only its SHA-256 hash, the same
  approach as `@cfm/supplier-request/node`. Reuse that pattern, and extract it to a shared place if
  it's cleaner. The raw token is needed only when sending, so either derive it as
  HMAC(secret, email) at send time or store it encrypted. **Recommended:**
  `token = HMAC-SHA256(UNSUB_SECRET, email)`. Nothing then needs storing, the send script can
  recompute it, and `unsub_token_hash` becomes unnecessary.

### 3.3 D1 schema

```sql
CREATE TABLE subscriber (
  email TEXT PRIMARY KEY,           -- lowercased
  sku_count TEXT,
  consented_at TEXT NOT NULL,
  consent_text_version TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE scan_counts (
  iso TEXT NOT NULL,
  day TEXT NOT NULL,                -- YYYY-MM-DD, UTC
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (iso, day)
);
```

Schema changes live as numbered migration files under `apps/scanner/migrations/`. Apply them with
`wrangler d1 migrations apply`.

### 3.4 Code shape

- Put the handler logic in plain TypeScript functions that take a small `Store` interface
  (`addSubscriber`, `removeByEmail`, `incrementScan`, `listSubscribers`, `countSubscribers`), with
  a D1 implementation and an in-memory one for tests. The logic then stays unit-testable with no
  Cloudflare runtime, and moving to Supabase or MailerLite later means writing a new adapter
  rather than rewriting the logic. This follows the same portability rule as `@cfm/ai`.
- Keep the Functions files thin: parse the request, call the logic, map the result to a response.
- Put the tests under `apps/scanner/test/` (or a new `packages/waitlist` if the logic grows) and
  make sure the vitest `include` glob picks them up.

## 4. Build, privacy notice and page changes

1. Set `WAITLIST_ACTION=/api/subscribe`. The existing D-024 mechanism already handles this, so no
   code change is needed.
2. Add the honeypot input to `waitlistForm()` in `build.ts`. Hide it with CSS, not
   `type="hidden"`, and give it `tabindex="-1"` and `autocomplete="off"`.
3. Add two static pages, `waitlist-thanks.html` and `unsubscribed.html`, using the same site header
   and footer as the uncommitted restyle.
4. **Make the privacy notice match the actual configuration.** Add a build variable
   `WAITLIST_PROCESSOR=cloudflare|mailerlite` that picks which processor section `privacy.html`
   renders. A production build must refuse when `WAITLIST_ACTION` is set but `WAITLIST_PROCESSOR`
   is not. The Cloudflare section says:
   - addresses are stored by Cloudflare in the EU (D1 EU jurisdiction);
   - Cloudflare, Inc. is a US company;
   - digests are currently sent individually by the operator;
   - nothing records opens or deliveries.

   The current MailerLite text survives unchanged for the later switch. This is a new build gate,
   and like the four existing ones it must be verified against a real failing case before it is
   trusted.
5. Remove or reword two claims in the waitlist and privacy pages so every claim is true on launch
   day:
   - The MailerLite paragraph about recording opens, which is not true in the interim.
   - "Every email has an unsubscribe link". Keep it only if the send script in §6 guarantees it,
     which it will.
6. **Controller address** (depends on decision 2 in §5). If Tabeen chooses the recommended option,
   `CONTROLLER_ADDRESS` becomes optional:
   - When it's unset, the notice renders "Postal address available on request at
     `__CONTACT_EMAIL__`".
   - `CONTROLLER_NAME` and `CONTACT_EMAIL` stay mandatory.
   - The build gate's error message and the README change to match.
7. **Keep the scanner's no-network guarantee unchanged.** `assertBundleCannotPhoneHome` still
   covers `app.js`, and the only fetch is still the relative `catalog/` path. Counting scans
   happens on the server (§3.1), so the bundle does not change.

## 5. Decisions only Tabeen can make

Each one has a recommendation. The implementer should record the answers as D-entries.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | **Host.** | Cloudflare Pages, Functions and D1 (EU). | The only option that is EU-stored, adds no new processor, needs no domain, and can count scans. |
| 2 | **Postal address in the privacy notice** before the PO box exists. | Leave it out. Publish the controller's name and a contact email, with the address "on request". The lawyer review budgeted in `01-` §8.1 confirms this. | GDPR Art. 13(1)(a) requires "identity and contact details". Whether an email address alone satisfies that has **not been verified** and is not legal advice. It's also why the lawyer review exists. |
| 3 | **Single or double opt-in.** | Single opt-in for now, with consent evidence stored (§3.2). Double opt-in comes with MailerLite. | Double opt-in needs a sending domain and email provider today, and both are blocked on the name (Q-6b). The honeypot plus a manual review before counting keeps the Gate 2 number honest. |
| 4 | **Count scans on the server** (§3.1), which amends D-021. | Yes. | Free-tier static hosts keep few or no raw request logs. Vercel Hobby keeps logs for about an hour, and Cloudflare's free plan has no log export. D-021's "count from host logs" probably can't produce the Gate 2 number. The counter stores no personal data and doesn't touch the client bundle. |
| 5 | **`CONTACT_EMAIL`**. | A dedicated free mailbox or alias rather than a personal address. It moves to the real domain later. | It's published on the page and becomes the address people send data-rights requests to. |

## 6. Sending the digest without an ESP (needed before the first digest, not before launch)

`scripts/digest-send.ts` follows the same pattern as `smoke-anthropic*.ts`:

- It's a dry run by default. It reads a Markdown or HTML digest file and a subscriber export, then
  renders **one email per recipient**, each with its own unsubscribe link (the HMAC token from
  §3.2) and a "reply UNSUBSCRIBE" fallback. It never uses BCC.
- Output goes behind a small `Sender` interface:
  - `export` writes a CSV for Gmail or Outlook mail merge. This needs no vendor and no domain,
    and works today.
  - `resend` is added only once a domain exists. `02-` already names Resend.
- `--confirm` is required to send anything. It sends at most N per run, and N is capped below
  the provider's daily limit.
- The footer contains the sender's identity, why the recipient is getting the email, and the
  unsubscribe link. For UK and EU recipients under PECR and the ePrivacy Directive, a working
  opt-out and the sender's identity are what's required. CAN-SPAM's postal-address rule applies
  to US recipients, who are not the ICP (D-033). If US signups appear, flag it and don't send to
  them until the PO box exists. This is **not verified legal advice**, and the §8.1 review covers
  it too.

## 7. Operator scripts

| Script | Does |
|---|---|
| `npm run waitlist:count` | Prints the signup total and the per-market scan counts by week, for the Gate 2 numbers. |
| `npm run waitlist:export` | Writes a CSV of email, sku_count, consented_at and consent_text_version to a gitignored path, in a format MailerLite can import. |
| `npm run waitlist:delete -- <email>` | Handles erasure requests. |

Each runs `wrangler d1 execute` against the remote database and needs Cloudflare credentials in
`.env.local`. Never print the credentials.

## 8. Order of work

1. Commit or branch the uncommitted scanner UI edits (§2).
2. Tabeen answers the five decisions in §5, and they are logged as D-entries.
3. Write the store interface, the subscribe and unsubscribe logic, and the tests, all with the
   in-memory store (§3.2, §3.4).
4. Write the Pages Functions, the D1 migrations, and the scan counter.
5. Make the build changes in §4. Verify each new gate against a real failing case, then revert
   the failing case.
6. Set up the Cloudflare account, create the D1 database with `--jurisdiction=eu`, and do a first
   deployment to `*.pages.dev` with `scanner:build` in production mode.
7. Run a live check on the deployed site:
   - a real signup;
   - a duplicate signup;
   - a honeypot submission;
   - an unsubscribe;
   - a scan in each market;
   - `waitlist:count`.
8. Update the scanner README and decisions.md, then commit the result as its own PR.
9. Before the first digest goes out: `scripts/digest-send.ts` (§6).

Steps 3 to 5 need no accounts and no money. Steps 6 and 7 need Tabeen's Cloudflare login.

## 9. When the PO box arrives

1. Put the PO box address in MailerLite's account settings. Before paying for the box, check
   **MailerLite's own terms** confirm a PO box is accepted. Third-party sources say it is, but
   that hasn't been verified against MailerLite itself.
2. `waitlist:export`, then import the CSV into MailerLite with the consent dates preserved.
3. Switch `WAITLIST_ACTION` to MailerLite's form endpoint and `WAITLIST_PROCESSOR=mailerlite`,
   then rebuild. The privacy notice switches automatically.
4. Set `CONTROLLER_ADDRESS` to the PO box.
5. Delete the D1 subscriber table once the import is verified. The notice must not claim two
   stores.

## 10. Out of scope

- Analytics of any kind on the scanner page.
- CAPTCHA or any JavaScript on the waitlist page.
- Automated digest scheduling. Sending is manual until the ESP.
- Renaming to Attesta (blocked on Q-6b).
- `apps/web`, auth and billing.
