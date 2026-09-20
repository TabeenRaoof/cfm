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

## Counting Gate-2 usage without any telemetry

There is no analytics in the page, and adding some would trip the privacy check above. It is
also not needed: **a scan is a fetch of `catalog/<ISO>.json`**, so the static host's own request
logs count scans by market, with no client-side tracking and no personal data beyond ordinary
web serving.

That covers "≥150 scanner uses". The other half of Gate 2 — "≥100 waitlist signups" — needs an
email capture, which cannot live on this page without breaking its guarantee. It belongs on a
separate page. Not built yet; see the note in the session summary.

## Known gaps

- **GB slices to a single requirement.** Correct — no EU requirement applies there — but it
  makes the UK view nearly empty, and the UK requirement is the catalog's least worked-through
  (`confidence: low`). Worth deciding whether to offer GB at launch at all.
- **Nothing is published**, so only `scanner:preview` builds today. Requirement review is on
  the critical path to Gate 2.

## Building for production

Four gates must pass, each verified against a real failing case before being trusted:

| Gate | Refuses when |
|---|---|
| Catalog | no requirement is published — the scanner would tell every seller they are fine |
| Slices | any offered market resolves to zero requirements |
| Privacy notice | controller name, address or contact email is still a placeholder |
| Bundle | `app.js` contains any way to transmit the visitor's file |

```bash
CONTROLLER_NAME="…" \
CONTROLLER_ADDRESS="…" \
CONTACT_EMAIL="…" \
WAITLIST_ACTION="https://assets.mailerlite.com/jsonp/<account>/forms/<form>/subscribe" \
  npm run scanner:build
```

`WAITLIST_ACTION` is the MailerLite hosted-form endpoint (D-026). Unset, the form renders
visibly disabled rather than discarding addresses.
