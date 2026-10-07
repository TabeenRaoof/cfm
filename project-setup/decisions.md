# Decisions log — CFM

Every entry records **what** was decided, **when**, and **why**. A decision recorded without its
reasoning gets reversed by whoever forgets it — including an assistant in a fresh session with no
memory of the conversation that settled it.

Superseded entries are marked, never deleted. The original reasoning usually still matters, and
knowing a thing was tried and rejected is worth as much as knowing what was chosen.

**Status field.** `Proposed` means it came out of the 12 September plan review and is waiting on
Tabeen; it is not yet binding and may be rejected. `Accepted` means it is settled and falls under
the do-not-relitigate rule. Nothing here is Accepted until Tabeen says so — an assistant does not
promote its own proposal.

Before claiming the next number, check every open branch, not only the one you intend to merge
into. Where a collision is unavoidable, take the next number free everywhere and say so in the
entry.

---

### D-001 · The product name is deliberately deferred; "CFM" is a working label
**Status:** Accepted · **Date:** 2026-09-12

`01-` §9 lists four candidate names, all explicitly unverified against EUIPO, UKIPO, USPTO and
domain availability. Adopting one now would let it harden into repository names, package
namespaces, a domain and an email sender before the trademark search happens — playbook Lesson 5,
where an input marked provisional in one draft becomes load-bearing in the next because the caveat
was dropped in transit.

"CFM" is chosen *because* it is obviously not a product name. It appears in this folder only.

Open: the name itself, with a decision date — see Open Questions Q-6.

---

### D-002 · Unresolvable applicability returns `unknown`, never `na` — the hard rule
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-1

`applies_when` clauses evaluate against product attributes that are frequently absent, because
customers import CSVs without those columns. The two available behaviours are not symmetric:
treating unresolvable as `na` deletes the requirement from the matrix and renders the SKU green,
which is a confident wrong answer in a product whose only job is to be right about this. Treating
it as `unknown` is less impressive and trustworthy.

`unknown` is never counted toward market-ready. Every requirement carries a unit test that feeds it
a product with the deciding attribute missing and asserts `unknown`.

This is the project's one inviolable correctness rule. It lives in the `tabeen_AGENTS.md` standing rules
and its refusal list, not only here.

---

### D-003 · Tenant isolation is tested per table, in the same pull request as the table
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-2

`02-` §10.1 writes RLS policies in week 1 and tests them in week 12, under hardening. Cross-tenant
leakage is the bug class that ends a B2B company outright, it is found by writing the test rather
than by reading the policy, and from week 6 the tables hold other companies' confidential supplier
documents. Eleven weeks of tables would accumulate under an untested policy.

A new table is not done until a test proves organisation A cannot read organisation B's rows in it.
The service-role key is used in jobs only, never in a request path.

---

### D-004 · Extraction accuracy is measured per field, on required fields, after normalisation
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-3

"≥90% field accuracy" has no denominator, and an aggregate hides exactly what matters: 92% overall
can be `issue_date` at 100% and `standards[]` at 40%, and `standards[]` is what the entire v2
standard-currency check depends on.

Definition: exact match after normalisation (dates to ISO, whitespace and case folded, standard
codes canonicalised), reported **per field**, over required fields only, on the golden set. No
prompt change ships that lowers any individual field, regardless of what it does to the average.

---

### D-005 · Erasure deletes bytes and keeps a tombstone; the audit log holds events and hashes only
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-4

`02-` §4 calls `document` the immutable original; §9 requires a GDPR deletion workflow and an
append-only audit log. Those conflict, and the resolution determines which columns exist, so it
cannot be left to a policy page.

Erasure deletes the R2 object and nulls extracted personal fields. The `document` row survives as a
tombstone holding `sha256`, page count, timestamps and the erasure event. `audit_log` records
events and hashes, never content. The trail stays truthful — a document was here, it was erased on
this date, on this request — while the personal data is genuinely gone.

---

### D-006 · On cancellation: export, then delete. Ten-year custody is never offered
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-5

GPSR's ten-year retention duty belongs to the economic operator, not to their software vendor.
Holding a former customer's technical files for a decade is storage cost, liability and a
data-protection problem dressed as a feature.

On cancellation a full technical-file export is generated for every SKU and made available for 30
days, after which everything is deleted. The ToS says so. Marketing never implies otherwise.

---

### D-007 · Extract from PDFs directly; render pages only for the human-review queue
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-6

`02-` §6.1 renders every page to PNG before classification. The API accepts PDFs directly, so
rendering is needed only for the review UI that shows a page image beside extracted fields — a
minority of documents, and lazily.

This removes a native rendering binding, a job and its storage from the week-4 critical path, which
matters given the hours finding in §S-1. The cheap text-layer check stays, to decide whether OCR is
needed at all. Page limits differ by model context window; check them rather than assuming.

---

### D-008 · A requirement without a primary source cannot be published, and its citation is shown
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-7

The requirement schema already carries `sources[]`, `confidence`, `last_reviewed_at` and
`reviewer`; nothing said the product displays them. `01-` §9's "every rule cites its source" was
written as a liability position, and a liability position that exists only in the terms of service
is not a defence.

It is also the answer to "why not just ask ChatGPT": a cited, dated, human-reviewed rule is what a
chat answer cannot produce. So the citation, the review date and any confidence below `high` appear
wherever the requirement appears — matrix, gap list, scanner, exported file — and CI rejects
catalog JSON lacking them.

---

### D-009 · No AI call from an unauthenticated path
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-8

The free scanner is public and takes an uploaded file. An unauthenticated endpoint that calls a
paid API is an abuse surface with no meaningful rate limit, and the scanner does not need one: its
job is to run the deterministic evaluator over CSV rows, which costs nothing and is the honest
demonstration of the catalog.

Enforced by a test, plus a row cap on uploads.

---

### D-010 · Catalog re-evaluation is a job, not a deploy step; assessments show their version
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §D-9

Compiling the catalog to the database "on deploy" means a deploy can change what a customer is
looking at mid-session, giving them rows computed against two versions with nothing saying so.

`assessment.catalog_version` already exists in the data model. The matrix displays it; a version
bump enqueues an Inngest re-evaluation job and writes the `catalog_change` record that feeds the
customer digest; the deploy itself changes nothing a user can see.

---

### D-011 · `01-` and `02-` are immutable; corrections live in `project-setup/`
**Status:** Accepted · **Date:** 2026-09-12

The business report and technical plan are frozen inputs, at Tabeen's instruction. They are not
edited, not even to fix a number now known to be wrong or a claim now known to be unverified.

Everything that would have been an edit is a delta in `project-setup/03-plan-review.md` or an entry
here. The cost is one indirection when reading; the benefit is that the reasoning that produced the
original is never overwritten by the reasoning that revised it — which is the same argument as
marking superseded entries rather than deleting them.

---

### D-012 · v1 is re-cut into a Gate-2 slice and a Gate-3 slice
**Status:** Accepted (Tabeen, 26 September 2026 — see D-048) · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §S-1, §S-2, §S-4

The twelve-week plan in `02-` §10.1 is roughly 3–5× the 60–100 hours available before 12 December,
and its serial dependency chain means extra hours would not fix the date anyway. Two of its items
are also mis-sequenced against the gates they exist to pass.

- **Slice A, weeks 1–6:** catalog v0, evaluator, CSV import, the public scanner, waitlist. No auth,
  no AI, no storage, no billing. This is what Gate 2 measures, and it is the portion that survives
  a Gate-1 kill.
- **Slice B, weeks 7–14:** auth, organisations, RLS, document upload, extraction for `rp_mandate`
  and `epr_certificate` only, evidence linking, assessment recompute, technical-file PDF export.
- **v1.5, Jan–Feb 2027:** supplier portal, remaining extraction schemas, MYC and Shopify exports,
  digests, full plan quotas.

`02-` §15.4's own bar for 12 December — one design partner has exported a technical file — is met
by Slice B.

**This is the largest proposed change and the one most worth arguing with.** It trades launch
surface for a date that can actually be hit.

---

### D-013 · Privacy artefacts are due before the first real upload, not before the first charge
**Status:** Accepted (Tabeen, 26 September 2026 — see D-048) · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §S-3

Design partners upload real documents containing third-party personal data from week 6. GDPR
obligations attach then, not on 12 December. `02-` §15.4 has the right list against the wrong
event.

Before the first real upload: privacy policy live, customer-facing DPA available, vendor DPAs
signed with everything that touches the data at that point (Supabase, Vercel, Cloudflare, the AI
provider, Resend), a written deletion procedure even if manual, and a design-partner agreement
covering what may be done with their documents and how they withdraw them.

Before charging: Paddle, PostHog, Sentry, and the rest of §15.4 unchanged.

---

### D-014 · One AI provider behind the gateway seam; the second when an eval can score the swap
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `03-plan-review.md` §S-5

Principle 1 ("no feature depends on one vendor") is satisfied by the interface and a test that
nothing outside `packages/ai` imports a provider SDK — not by three live adapters maintained
before any extraction works and before a golden set exists to compare them on.

Model and provider names are configuration from day one, which is the genuinely cheap and genuinely
load-bearing half. The second adapter arrives when the eval harness can measure the swap; the
open-weight route when a price event makes it matter.

---

### D-015 · A blank spreadsheet cell is unknown, never "no"
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** implementation of D-002

D-002 governs the evaluator. This governs the layer beneath it, and without it D-002 is
decorative: the catalog's three-valued logic is only as honest as the data fed into it.

`packages/import` keeps `undefined` (we were not told) distinct from `null` (we were told:
none). A blank `has_battery` cell is indistinguishable from an export with no battery field at
all, so both become `undefined` and the seller is asked. Reading it as `false` would be right
most of the time — which is what makes it dangerous, because the failures are rare, silent, and
land on exactly the SKUs that needed the requirement.

An unrecognised country or a malformed barcode is likewise `undefined` with a warning, never
passed through. "Made in PRC" would derive as non-EU: right by accident is still a bug.

---

### D-016 · Deterministic first, enforced by the gateway rather than by review
**Status:** Proposed · **Date:** 2026-09-12

Every AI task must declare either a deterministic attempt that runs *before* the model, or a
written reason no deterministic path exists. `Gateway.runTask` runs the attempt first and only
reaches a model when it returns `undefined`; a task registered without the declaration fails a
test. There is no other code path to a model.

The first task shows why it is worth the ceremony: most compliance documents announce what they
are on page one, so a phrase match over the PDF text layer classifies them at zero cost, and —
more importantly — reproducibly. A deterministic step can be shown to an authority; a model call
cannot.

The attempt must escalate rather than guess. A free wrong answer is the worst outcome available.

---

### D-017 · Token budgets are declared per task and enforced before the request is sent
**Status:** Proposed · **Date:** 2026-09-12

Each task states the most input and output tokens it may spend, and `prepareInput` is where it
sends less: the text layer instead of page images, two pages instead of twelve, with what was
omitted reported. The gateway refuses to exceed the budget rather than spending the money,
because a silent overspend is only discovered on the invoice.

Every call is attributed to an organisation with its provider, model, prompt version, tokens and
cost — including calls resolved deterministically, recorded at zero, so the saving is visible.

---

### D-018 · Provider portability is a tested property; extraction quality is a measured one
**Status:** Proposed · **Date:** 2026-09-12 · **Source:** `packages/ai/README.md`

Provider SDKs may only be imported from `packages/ai/src/providers/`, enforced by a test that
walks every file in every package. Capability differences that actually break a swap — context
window, native PDF support, how a schema-valid result is obtained, batch tier, price — are
modelled explicitly in `ModelCapabilities`, and every registered task is run against three
capability profiles in CI.

The honest limit, stated so nobody later assumes otherwise: this proves the system runs
unchanged on a different provider. It cannot prove a different model reads a scanned test report
as accurately. The golden-set eval is the gate for a provider change, exactly as for a prompt
change (D-014).

---

### D-019 · The deterministic packages run on a bare Node with no build step
**Status:** Proposed · **Date:** 2026-09-12

`@cfm/catalog`, `@cfm/import` and `@cfm/scanner` are dependency-free and run under
`node --experimental-strip-types`. That keeps the CI gate cheap, makes the evaluator usable from
a one-off script, and keeps the public scanner path free of anything that could reach a network.

It is a claim that decays silently — one `enum` or constructor parameter property anywhere in
the chain breaks it. So `erasableSyntaxOnly` is on in tsconfig and `npm run smoke` actually does
it in CI. Both were added after the runtime caught four real violations.

---

### D-020 · The public scanner runs client-side, on a static host, as its own deployment
**Status:** Accepted (Tabeen, 12 September 2026)

`@cfm/scanner` is dependency-free and needs no network, so the whole evaluation runs in the
visitor's browser: no CSV upload, no personal-data processing, no dependency on D-013's
artefacts, and "your file never leaves your computer" is a genuine, checkable claim rather than
a promise. Cost accepted: the requirement catalog ships to the browser, narrowed per market
(D-022's slicing) so a scraper enumerates markets rather than pressing save once.

Separate deployment from `apps/web`, because the scanner is due early and must not wait on
auth, database or billing decisions Gate 1 may make moot. Reconsider if the catalog reaches a
depth where the snapshot itself becomes the asset worth protecting.

---

### D-021 · Scanner usage is counted from host request logs, not from page telemetry
**Status:** Accepted (implemented) · **Date:** 2026-09-12

The scanner page carries no analytics — the build's own privacy check would reject any (D-027).
A scan is a fetch of `catalog/<ISO>.json`, so the static host's own request logs count scans by
market with no client-side tracking. This covers Gate 2's scan-count limb; the waitlist
signup-count limb needs the separate waitlist page (D-024), because an email capture cannot sit
on the scanner page without breaking its guarantee.

---

### D-022 · `@cfm/catalog` splits its browser-safe surface from its Node entry
**Status:** Accepted (implemented) · **Date:** 2026-09-13

`loadCatalogFromDir` imported `node:fs`, which made the whole evaluator unbundleable for a
browser — discovered only when the scanner's esbuild step failed, since nothing else would have
noticed. The pure surface is `@cfm/catalog`; filesystem loading is `@cfm/catalog/node`.
`test/browser-safe.test.ts` asserts nothing reachable from the index imports a `node:` built-in,
because the failure mode is an opaque build error at deploy time rather than anything a
reviewer would spot. The same split was later applied to `@cfm/channels` for the same reason.

---

### D-023 · GB is offered as a market at launch
**Status:** Accepted (Tabeen, 12 September 2026)

The UK slice held one requirement at `confidence: low` when this was decided, which read as a
broken tool rather than an honest one — offering GB carried an obligation to deepen the UK
catalog before launch, which is why seven more UK drafts were written the same session (now
eight GB requirements). `01-` §1.1 makes the primary customer a UK-established brand selling
*into the EU*, so their scanner view is the EU markets, not GB; GB is breadth and credibility —
a UK seller who cannot see their home market assumes the tool is unfinished.

---

### D-024 · The waitlist is a separate page, platform-agnostic, disabled until configured
**Status:** Accepted (implemented) · **Date:** 2026-09-13

A plain HTML form on `waitlist.html`, posting to a hosted email-platform endpoint set by one
build-time variable (`WAITLIST_ACTION`). No JavaScript, no shared bundle with the scanner, so
the scanner's guarantee that nothing is transmitted stays literally true — the scanner links to
the waitlist rather than posting to it. Unconfigured, the form renders visibly disabled with a
notice, because a signup box that looks like it worked and did not is worse than no signup box.

---

### D-025 · The 32 hours before 12 December go to distribution and review, not to building
**Status:** Accepted (Tabeen, 13 September 2026)

At 2–3 hrs/week there are roughly 32 hours before charging opens. Two facts reshape what they
are for: the engineering is largely built, and `01-` §9 requires 20+ hrs/week from 12 December
for OPT — so capacity rises roughly eightfold on a known date. Building can wait for that
capacity; distribution cannot be bought back. The pre-December hours go to requirement review,
seller conversations and forum presence — work only Tabeen can do — while code continues in
parallel without competing for them. Full arithmetic in `04-capacity-replan.md`.

Gate 1 and Gate 2 collapse into one activity: answering seller questions in forums produces the
interviews, the scanner uses, and the catalog roadmap from the same hour. Gates move in time,
not in ratio: 8 conversations by 2 Nov; 100 scans or 60 waitlist by 20 Dec; 5 paying by 28 Feb.
The 12 December charging date is fixed by OPT and does not move. *(Superseded by D-046: the
I-765 requests 4 January 2027, and the real trigger is the approved EAD's start date.)*

**Addendum, 19 September 2026:** no warm UK/EU contacts exist (Q-4, now closed). Forum and
community engagement is therefore the only discovery channel available, not one of several —
which raises the stakes on the ~1.5 hrs/week of forum presence this decision already names as
the single point of failure.

---

### D-026 · MailerLite is the email platform for the waitlist and the digest
**Status:** Accepted (Tabeen, 13 September 2026)

Checked against the provider's own pages on 13 September 2026 rather than recalled, because the
answer ends up asserted in a privacy notice (playbook Lesson 33). Free tier covers Gate 2's 60
waitlist signups with room (250 subscribers, 2,500 emails/month); the DPA is incorporated into
the terms, so nothing to negotiate separately at 2–3 hrs/week; subscriber data sits in EU data
centres (Germany, Netherlands).

**A correction the verification caught:** the original recommendation partly rested on
MailerLite being EU-established. It is not — MailerLite, Inc. is a US company. EU data storage
is real; EU establishment is not, and the privacy notice (D-027) says so rather than repeating
the error. Reconsider when the digest becomes the paid product in `01-` §5.3.

---

### D-027 · The privacy notice is drafted in-repo and gated by the build
**Status:** Accepted (implemented) · **Date:** 2026-09-13

`apps/scanner/src/privacy.html` covers both surfaces honestly: the scanner collects nothing and
could not retrieve a visitor's file if it wanted to; the waitlist names MailerLite, its US
establishment, its EU storage, and what that means for transfers. Controller name, address and
contact email are build-time variables, and **a production build refuses while any is
unfilled** — a notice published with `[YOUR ADDRESS]` in it is worse than none. This is a draft
for review, not legal advice; `01-` §8.1's budgeted lawyer review is what actually clears it.

The production scanner build now has four gates, each verified against a real failing case
before being trusted: no published catalog, an empty market slice, unfilled privacy
placeholders, and a bundle capable of transmitting the visitor's file.

---

### D-028 · The technical file is self-contained HTML, not a generated PDF
**Status:** Accepted (implemented) · **Date:** 2026-09-13

A single HTML file with print styles produces the same PDF when a seller prints it, keeps
`@cfm/techfile` dependency-free (no headless-browser operational surface for one person to run,
per `02-` §1 principle 6), and can be opened by an authority with no software at all. Three
properties are asserted by tests rather than left to review, because this is the document a
seller would hand to a regulator: it never claims compliance (a closed list of forbidden
phrases is checked); undetermined requirements are listed first and are never omitted, even
when empty, because an absent section reads as reassurance; and every interpolated value is
escaped, since product titles come from an untrusted customer spreadsheet and the document
travels onward.

---

### D-029 · Anthropic data-residency and cache economics, verified
**Status:** Accepted (verified fact, not a judgement) · **Date:** 2026-09-13 · **Closes:** Q-8

Both claims inherited from `02-` §3 and §6.5 were checked against Anthropic's own documentation
rather than recalled, and both are correct: cache reads are 0.1x base input (0.025x on Fable
5.1/Mythos 5.1); `inference_geo` accepts only `"global"` and `"us"` — **no EU option exists** —
priced at 1.1x. Findings the plan does not contain: cache *writes* cost a premium (1.25x short
TTL, 2x long TTL) — "reads are 10%" is half the arithmetic, so `cacheBreakEvenReads()` computes
the real break-even from a provider's declared capabilities; **workspace geo (data at rest) is
US-only and fixed at creation**, which is the constraint that actually governs the privacy
policy, stronger than the inference-geo one; and `inference_geo` needs Claude 4.6+, so Haiku
4.5 — where `02-` §6.3 routes classification — returns a 400, meaning a residency requirement
would force classification onto a costlier model. Re-verify before the product privacy policy
is written (not the scanner's, which processes nothing) — vendor terms move faster than
policies do.

---

### D-030 · Channel exports are template-driven data files, and unverified templates refuse
**Status:** Accepted (implemented) · **Date:** 2026-09-13

A marketplace's bulk-upload template is their artefact — headers unpublished, changing without
notice, undeliverable from anything we hold — so a template is a JSON data file, not code, per
`02-` §8.1's own instruction to keep them as versioned fixtures. `renderChannelExport` **throws**
on an unverified template unless the caller opts in explicitly, because a guess dressed as a
file is worse than no export: rejected on upload, and the seller concludes the tool does not
work. Amazon's template ships as an explicit placeholder (every header flagged); Shopify's
header format (`Name (product.metafields.<namespace>.<key>)`) was read from Shopify's own docs
so the shape is right, though it stays unverified until run through a real import. The neutral
full export needs no template and so cannot be wrong about anyone else's format.

The hard rule reaches this boundary too: a fact never supplied exports as a blank cell, never
as "No"; an undetermined requirement renders as "Cannot determine - information needed", never
as "Not applicable" — this is the last place our data passes before entering a system we cannot
correct.

---

### D-031 · Extraction schemas are declared once and narrowed before any model sees them
**Status:** Accepted (implemented) · **Date:** 2026-09-13

`@cfm/documents` declares each document type's fields once in `schemas.ts`, deriving the JSON
Schema a model fills, the deterministic validators, and the review card from that single
declaration — written separately, the three drift. Deterministic-first applies at the field
level: patterns run over a document's text layer before any model call, and the schema sent to
the model is narrowed to whatever they could not answer, measured by a test to actually shrink
the request rather than just the prompt's wording. Two rules keep the patterns honest: an
unverified pattern (format inferred, not confirmed — the LUCID digit count) yields a candidate
that always goes to review, never an accepted answer; and a pattern matching twice declines to
choose, since two plausible issue dates is exactly when a human should look.

**The confidence gate is deterministic and the model never scores its own work** — a
self-reported confidence is the one number a model cannot calibrate. Acceptance needs every
required field present, every applicable validator passing, no unconfirmed pattern and no
ambiguity; anything else produces a review card, erring toward human time because an extraction
accepted wrongly becomes evidence behind a green cell.

This forced a design change: `TaskDefinition.schema` became a function of the input rather than
a constant, since extraction's schema shrinks with every regex hit, and tasks now declare a
`sampleInput` so registry-wide rules can exercise a task whose schema varies.

---

### D-032 · Solo definition of done confirmed: CI plus self-review discipline, no second reviewer
**Status:** Accepted (Tabeen, 19 September 2026) · **Closes:** Q-9

`tabeen_AGENTS.md`'s definition of done deletes the second-approver step from the ProofShape
original and replaces it with CI as the gate plus disciplined self-review (read the diff in the
PR view, not the editor, against the acceptance criteria). Confirmed explicitly rather than
inherited silently, per playbook Lesson 32 — a definition of done that quietly drops a step is
worse than one that records the step as consciously removed, because a recorded removal can be
restored the day a second person joins. No file changes; the file already reads this way.

---

### D-033 · UK-established brands are the ICP for discovery and Gate 1
**Status:** Accepted (Tabeen, 19 September 2026) · **Closes:** Q-1

`01-` §12.1 already recommended this — UK brands for discovery, agencies for the first paid
tier — and nothing found since gives a reason to prefer agencies first. Confirmed rather than
left open, and it settles who the onboarding call, the scanner's default framing, and the
forum-engagement motion in D-025 are aimed at. `is_agency` and `client` stay in the schema
(`02-` §4); the ICP decision touches sequencing and content, not the data model.

---

### D-034 · Catalog depth prioritises general goods over category-specific requirements
**Status:** Accepted (Tabeen, 19 September 2026) · **Closes:** Q-2

Toy safety, battery and WEEE stay in the catalog as the category flags already drafted
(`eu.flag.toy-safety`, `eu.flag.battery-registration`, `eu.flag.weee-registration`, their UK
equivalents), but **category depth — full EN 71 sub-standards, CE-directive detail beyond the
flag — is not drafted next.** What is drafted next is breadth across the general
GPSR/DSA/EPR/PPWR core, which covers every seller regardless of category and is what `01-` §5.1
actually specifies for v1. No requirement already in review needs re-prioritising: the four
packets in flight are all general-goods requirements and remain the right first four.

---

### D-035 · Attesta chosen as the name; not yet verified, still a working label
**Status:** Chosen, unverified (Tabeen, 19 September 2026) · **Closes (partially):** Q-6

Of three candidates offered (Provenway, ProofPack, Attesta), Tabeen chose **Attesta** —
explicitly for reading as European, which matters given the current EU/US climate for a product
selling compliance trust to EU sellers.

**A same-turn search check, not a formal registry search:**

- `attesta.com` returns no DNS record at all (`ENOTFOUND`) — a positive signal that it is
  unregistered, but this is not a WHOIS lookup and is not confirmation.
- `attesta.io` is live: "digital identity and attestation," vague positioning, unclear
  commercial maturity. Adjacent conceptually (attestation) but a different product category
  (identity, not physical-goods compliance evidence).
- A general web search for a hit resembling "Attesta — EU AI Act compliance" turned out, on
  fetching the actual page, to be a product called **Valesta**, not Attesta — a stale page
  title in the search snippet. Corrected before it was reported as a false collision; worth
  recording because it shows why a title in a search result is not the product's real name.
- **EUIPO, UKIPO and USPTO could not be queried from here.** Their search interfaces are
  interactive database tools, not crawlable pages, and no hit in general web search is not the
  same as a cleared registry search. This is a genuine tooling limit, not a completed check.

**Consequence: "CFM" remains the working label everywhere in the repository.** D-001's
placeholder discipline holds exactly as before — nothing is renamed, no package, folder or
domain uses "Attesta," until a formal search of the three registries and a real domain
registrar check (not a search-engine proxy for either) has been done. That search is a task for
Tabeen or a lawyer, not something achievable from this environment.

**26 September 2026 — name settled on "Attesta Compliance"; a real collision surfaced.** Tabeen
chose the fuller name **Attesta Compliance** (the `attestacompliance@gmail.com` contact address
set up the same day already reflected this). A same-turn check, same limits as above:

- `attestacompliance.com`, `.io`, `.co.uk`, and `attesta-compliance.com` all return no DNS record
  — a positive-but-unconfirmed signal, not a WHOIS check.
- **A real, live collision, verified by fetching the actual page (not just the search snippet,
  learning from the Valesta false positive above):** **attestagrc.com** sells a product branded
  "**Attesta**" (full name "Attesta GRC") — a GRC/compliance-management platform for ISO 27001,
  NCA ECC and SAMA CSF engagements, priced $399–$1,799/month, targeting consultants and
  enterprises in KSA/UAE/Pakistan/SE Asia. Different vertical and geography from this product
  (Gulf-region multi-framework GRC vs. EU/UK physical-goods product compliance), but the same
  word, in the same broad category — "a compliance software product called Attesta" — live and
  commercially active today. This is materially different from the earlier Valesta near-miss:
  that one wasn't actually named Attesta; this one is.

**This raises the bar Q-6b already set, it doesn't clear it.** Nothing is renamed. "CFM" stays
the working label until Tabeen or a lawyer runs the actual trademark and domain-registrar
search — and that search now has a specific, concrete prior hit to weigh, not just an absence of
evidence either way. Q-6b's own 30 September deadline is four days out at the time of this entry.

---

### D-036 · The churn-target arithmetic is corrected to match the stated $50–75 blend
**Status:** Accepted (Tabeen chose Option B, 19 September 2026) · **Closes:** Q-7

`01-` §6 states "$4K MRR you need 6–10 new customers every month just to stand still" at 4–6%
monthly churn, but that figure is only consistent with a ~$29 blended price (138 customers at
$4K MRR); at the $50–75 blend used everywhere else in that section (53–80 customers), the same
churn rate loses roughly 2–5 customers a month, not 6–10.

**Chosen resolution (Option B): keep the $50–75 blend, correct the customer-replacement
figure.** At $50–75 blended price and 4–6% monthly churn, standing still needs **roughly 2–5
new customers a month**, not 6–10. This is consistent with the Growth-tier positioning used
everywhere else in `01-`, rather than the Starter-heavy mix the original 6–10 figure implied.

`01-` itself is not edited (D-011 — it is immutable); this is the correction that supersedes
its churn-replacement figure wherever the plan is used for actual target-setting, e.g. in
`01-` §7.4's funnel targets and in any future pricing-page copy.

---

### D-037 · The Anthropic adapter went live; first real-money calls verified the whole seam
**Status:** Accepted (implemented) · **Date:** 2026-09-19

`packages/ai/src/providers/anthropic.ts` is written and, per D-014, is the one adapter behind
the gateway seam. Two live, `--confirm`-gated calls (`scripts/smoke-anthropic.ts` for
`classify_document`, `scripts/smoke-anthropic-extract.ts` for `extract_document`) exercised the
full path — gateway, deterministic gate, provider, budget check, spend limit, cost tracking —
against the real API for the first time, each capped locally (`maxTotalSpendUsd`) independent of
the account-level cap in the Anthropic Console. Total spend across both: **$0.001739**, no real
documents involved (synthetic text written directly into each script).

Both calls also found a real defect, which is the point of running them rather than trusting the
fake-provider tests alone: `extract_document`'s deterministic pass did not resolve `issue_date`
against an RP mandate phrased "Signed on: …" — only issue-style labels ("date of issue", "issued
on") were recognised. Fixed in `packages/documents/src/patterns.ts` (added signed-on/signé
le/unterzeichnet am equivalents), verified with zero further API cost by calling
`extractDeterministically` directly, and covered by a regression test.

**Models and prices, verified against Anthropic's own documentation on 2026-09-19 — re-verify
before trusting this again, per the standing rule against restating vendor facts from memory:**
classification routes to `claude-haiku-4-5` (200K context, $1/$5 per MTok in/out), extraction to
`claude-sonnet-5` (1M context, $2/$10). The bare alias `claude-haiku-4-5` resolved to the dated
snapshot `claude-haiku-4-5-20251001` in the response — normal aliasing behaviour, not an error.

**A second finding, closed in a follow-up correction rather than left standing:** the cache-cost
arithmetic in the adapter as first written was wrong — it subtracted `cache_read_input_tokens`
from `input_tokens` (double-discounting a bucket that Anthropic's `input_tokens` field already
excludes) and never read `cache_creation_input_tokens` at all, so a cache write — the 1.25x/2x
premium D-029 calls "half the arithmetic" — was billed at zero. Invisible in both live smoke
tests because neither request set `cacheable: true`. Corrected the same day, with `Usage`
extended to carry cache-write tokens as its own bucket and a regression test asserting the three
input buckets are additive rather than overlapping.

---

### D-038 · `@cfm/supplier-request`: the deterministic half of the supplier-request flow
**Status:** Accepted (implemented) · **Date:** 2026-09-19

`02-` §10.1 week 7 ("Supplier request flow: template (EN/ZH), magic-link upload page, reminders")
is split the same way `@cfm/catalog` and `@cfm/channels` already are (D-022): everything that
does not touch a filesystem or a clock is in the package's pure surface, and only magic-link
token generation is Node-only (`node:crypto`, split into `src/node.ts`), enforced by the same
`browser-safe.test.ts` pattern.

**No model call anywhere in this package**, by design — the lifecycle state machine
(`src/request.ts`), reminder scheduling (`src/reminders.ts`) and EN/ZH email copy
(`src/templates.ts`) are all deterministic. Chinese was included because a meaningful share of
sellers' suppliers are China-based factories (`02-` line 40, line 319).

Design decisions worth recording because each replaced a first attempt that looked reasonable
and turned out to have a hole in it:

- **A `RequestedItem` carries `requirementId`.** Without it, `EvidenceView.hasOpenRequest` in
  `@cfm/catalog`'s evaluator — the entire reason the `pending` status exists — has nothing to
  match a request against. This is what `@cfm/evidence` (v1.5 groundwork, in progress) reads to
  populate that method.
- **Fulfilling an item requires the request to have been sent first.** A `draft` was never
  emailed, so no magic link exists yet for anything to have raced. The first version allowed
  fulfilment from `draft` on the theory that "an upload could race the email" — which left a
  request that could never subsequently be sent, since `markSent` requires `draft` and fulfilling
  had already moved it past that.
- **A late upload against an `expired` request still counts.** `expired` is terminal for sending,
  opening and reminders, but not for fulfilment — discarding a document that genuinely arrived
  because a deadline had already passed would be the hard rule's false-negative failure mode
  (`unknown` vs `na`) in a different costume. `cancelled` and `fulfilled` still refuse.
- **Timestamps are parsed, never compared as strings.** `asOf > dueAt` on raw ISO strings only
  agrees with chronological order while every timestamp is UTC in an identical format.
- **Reminders stop once the due date has passed.** Without this, every remaining offset in
  `REMINDER_OFFSETS_DAYS` is satisfied once `daysUntilDue` goes negative, so an un-expired
  overdue request would keep working through its remaining reminders one cron run at a time.
  What should happen instead is expiry (`expireIfDue`), not another nudge about a date already
  gone — this package does not own the cron job that would call both in the right order, so the
  guard is structural rather than left to caller discipline.

**Not built, and deliberately not**: sending email (Resend wiring), the upload page itself, and
the Inngest cron binding — those need the app/infrastructure layer this repo does not have yet
(see `tabeen_AGENTS.md`'s repo map, corrected the same day). This package is the part that is
provider-agnostic and fully testable without any of it.

### D-039 · `@cfm/evidence`: linking is market-scoped, and refusing beats guessing

**Status:** Accepted (implemented) · **Date:** 2026-09-19

The missing middle between an accepted extraction (`@cfm/documents`) and an assessment
(`@cfm/catalog`'s `evidenceFor`/`hasOpenRequest`): nothing previously turned a `decision: "accept"`
verdict into the `EvidenceRef[]` the evaluator reads, so no upload could ever move a cell off
`missing`. `@cfm/evidence` is three small, independently testable pieces:

- **`record.ts`** — `evidenceFromVerdict` turns an accepted `ExtractionVerdict` into an
  `EvidenceRecord`, and throws rather than returning a half-built record if the verdict was not
  actually accepted. `validTo` comes from the schema's own `valid_to` field when present, `null`
  otherwise — never guessed from a different field.
- **`scope.ts`** — `requirementMarketScope` reads a requirement's `applies_when` for any leaf on
  `market.iso_country` (plain equality or an `in` matcher, including inside `all`/`any`/`not`) and
  returns the set of countries named, or `{ kind: "unscoped" }` if none is. It answers "which
  markets does this requirement's text mention", not "does this requirement apply" — the two are
  different questions, and only the evaluator's own `evaluateCondition` answers the second.
- **`link.ts`** — `linkEvidence` is the reason this package exists. **The concrete failure it
  exists to prevent:** `de.epr.packaging-lucid` and `fr.epr.packaging-citeo` both require
  `epr_certificate`; matching evidence to a requirement by document type alone would let a German
  Lucid certificate satisfy the French Citeo row — a false green with real regulatory
  consequences. `linkEvidence` checks every document against every requirement that wants its
  type, and for each pairing where the requirement is market-scoped, requires the evidence's own
  `country` field to be in that scope. No stated country against a scoped requirement is a
  refusal, not a link — the same "unknown is not na" discipline as the evaluator's own hard rule,
  applied one layer earlier. Every refusal is returned (`RefusedLink[]`), not merely dropped, so a
  caller building a review UI can show *why* an upload did not close a row instead of a silent
  no-op. `hasOpenRequest` is wired from the same call: it is true when a non-terminal
  `SupplierRequest` has a `requestedItems` entry for that `requirementId` whose `fulfilledAt` is
  still `null` (D-038's `requirementId` field is what makes this possible at all).

**Not built, and deliberately not**: persistence (which documents are "the current evidence set"
for a product is a caller/database concern), and confidence scoring for market matches beyond the
single `country` field — multi-field scoping (e.g. by `scheme_name`) is not needed by any
requirement in the catalog yet, so it was not speculatively added.

---

### D-040 · New fact `organisation.sells_direct_to_end_users`, added to close the PPWR AR scoping gap

**Status:** Accepted (implemented) · **Date:** 2026-09-20

`eu.ppwr.authorised-representative` was held at PR #4 review (batch-3 catalog packet) because its
`applies_when` — `organisation.established_in_market: false` — was broader than PPWR
Art. 45(3)'s actual trigger, risking over-blocking a non-EU seller who sells wholesale to an
already-established local distributor and never itself needed an authorised representative.

Read Regulation (EU) 2025/40 Art. 3(1), point (15) directly rather than relying on the secondary
summary used at first draft. Its five sub-tests, (a)-(e), split cleanly: (a)/(b) are pure
home-market tests and structurally cannot trigger Art. 45(3), which only ever fires cross-border;
(c)/(d) are the cross-border test, and the operative word missing from the modelled condition was
**"directly to end users"** — a manufacturer selling wholesale to a local distributor, who then
resells to consumers itself, is not the Art. 3(1)(15) "producer" for that market at all (the
distributor is, under (a)/(b)), so the manufacturer never needed an AR there.

Added `organisation.sells_direct_to_end_users` (plain input fact, same shape as the existing
`organisation.established_in_market`, no code change needed beyond the fact itself — the
`organisation.` prefix is already accepted by `validate.ts`'s `checkFactPath`) and required it
`true` in `applies_when`. Absence now correctly resolves `unknown` rather than either `applies` or
`na` (`hard-rule.test.ts` covers this generically; `evaluate.test.ts` adds two cases specific to
this row). Added the fact to `FULLY_KNOWN` in `test/fixtures.ts` (`true`, matching that fixture's
own stated intent of maximising which requirements apply) rather than leaving it for the hard-rule
test to discover as an omission.

**Deliberately not modelled**: Art. 45(3)'s second subparagraph, which lets a Member State
additionally require an AR from third-country-established producers at that state's discretion,
independent of the direct-to-end-user test. That is a national-law variation, the same shape as
the still-unverified `at.epr.authorised-representative` / `es.epr.authorised-representative` rows,
and is out of scope for this EU-wide floor requirement.

### D-041 · Batch 4 (AT/BE/IT) national-EPR rescopes, and publishing 7 country packaging schemes

**Status:** Accepted (implemented) · **Date:** 2026-09-20

PR #6 read the primary statutes for the seven national packaging-EPR drafts flagged by
`review/epr-national-schemes.md` (AT ×2, BE, ES ×2, IT, NL). Four had no logic issue and were
published straight from that reading: `nl.epr.packaging-verpact` (Art. 8(1) Besluit beheer
verpakkingen 2014, 50,000 kg/year threshold), `es.epr.authorised-representative` (Art. 17.2 RD
1055/2022), `es.epr.packaging-rpp` (Art. 14-16 RD 1055/2022), `at.epr.packaging-edm`
(§ 13g(1) AWG 2002).

Three surfaced genuine scoping mismatches between the drafted `applies_when` and the primary
text, held at first review (PR #6) and resolved in the same PR once Tabeen decided each:

1. **`at.epr.authorised-representative`** — same shape as D-040. § 12b(1) AWG 2002 makes AR
   appointment mandatory only for a distance seller with no AT establishment selling **to a
   private end consumer**; a seller selling only to businesses has an optional right under
   § 16a, not a duty. Added `organisation.sells_direct_to_end_users: true` to `applies_when`,
   reusing D-040's fact rather than inventing a new one.

2. **`be.epr.packaging-ivc`** — the 2008 Cooperation Agreement's own text sets a **300 kg/year**
   threshold on both the take-back duty (Art. 6) and the reporting duty (Art. 18, worded as
   applying to "the responsible company subject to the take-back obligation"), contradicting
   the draft's "no de minimis" summary, which came from IVC/CIE's own guidance page rather than
   the treaty itself. Added `organisation.be_packaging_kg_previous_year >= 300` to
   `applies_when`, same shape as the NL row's threshold in this batch.

3. **`it.epr.packaging-conai`** — CONAI's own membership rules state foreign companies "are not
   obliged to join CONAI, but they may do so voluntarily," corroborated by an independent
   secondary source. A foreign seller with no Italian establishment cannot join CONAI as a
   standard member, so telling it that it must would be a false positive. Added a new fact,
   `organisation.has_it_fiscal_representative`, and scoped `applies_when` to
   `any: [organisation.established_in_market, organisation.has_it_fiscal_representative]` —
   absence of both resolves `na`; not knowing either resolves `unknown`, per the hard rule.
   **Deliberately not modelled**: who, if anyone, is responsible for CONAI-side EPR obligations
   when a foreign seller has neither an Italian establishment nor a fiscal representative — no
   equivalent to Spain's first-distributor fallback has been identified for Italy yet.

Added `organisation.be_packaging_kg_previous_year` and `organisation.has_it_fiscal_representative`
to `FULLY_KNOWN` in `test/fixtures.ts` and dedicated tests in `evaluate.test.ts` for all three
rescopes (the applies-below-threshold / na-above-threshold pairs, and the unknown-when-absent
case for each). Catalog gate after this PR: **20 published, 8 drafts** — every remaining draft is
now either category-specific (batteries, toys, WEEE, UKCA/CE marking — deprioritised per D-034)
or `uk.gpsr.uk-responsible-person` (held pending UK secondary legislation, not a research gap).

### D-042 · Batch 5: the last 7 category-specific requirements published; catalog formally closed out

**Status:** Accepted (implemented) · **Date:** 2026-09-20

PR #7 read the primary statutes for the last 7 drafts — batteries, toys, WEEE, and UK marking —
excluding `uk.gpsr.uk-responsible-person`, which stays held on legislation (D-039-adjacent, not
research). Unlike batches 4 and 5's predecessors, this pass surfaced almost no scoping ambiguity;
its main finding was **two real date bugs**, caught only by reading each statute's own
commencement/application clause rather than trusting the drafted date:

- `eu.flag.battery-registration`: `effective_from` was a year early (2024-08-18 → 2025-08-18).
  Regulation (EU) 2023/1542 Art. 96 states Chapter VIII — which contains Art. 55, the actual
  registration article (not Art. 56, which is EPR financing and was the drafted citation) —
  applies a full year after several other provisions that share the 2024 date.
- `uk.toys.safety`: `effective_from` was a month early (2011-07-20, copied "by analogy" from the
  EU Directive → 2011-08-19, SI 2011/1881's own commencement clause).
- `uk.batteries.producer-registration`: `effective_from` was three months late in the other
  direction (2010-01-01 → 2009-10-15, SI 2009/890's actual registration-duty dates).

Tabeen approved all seven outright and explicitly endorsed leaving one nuance unmodelled: UK
battery registration has two tracks (1-tonne threshold for portable batteries via a compliance
scheme; thresholdless direct registration with the Secretary of State for industrial/automotive)
that `applies_when` doesn't distinguish. Her reasoning: "sub-1-tonne producers still have a
baseline statutory obligation to register (just via a different administrative track), the
boolean requirement to hold a registration remains true. Modeling the threshold would add
complexity without changing the ultimate gating outcome."

Publishing all seven had one direct test consequence: `techfile/test/render.test.ts`'s "not yet
reviewed" citation test ran against the real catalog (`includeDrafts: true`) and relied on *some*
requirement applicable to a German toy assessment being unreviewed — which stopped being true
once every EU/DE-applicable row was published. Split the assertion: general confidence-rendering
keeps the toy/DE fixture; "not yet reviewed" gets its own test targeting
`uk.gpsr.uk-responsible-person` directly (GB market, non-UK-established seller), the one row that
can still exercise that fallback text, rather than depending on whatever happens to be unreviewed
on a given day.

Catalog gate after this PR: **27 published, 1 draft** — every drafted requirement is published
except the one deliberately held on legislation. The drafted catalog from the 12 September
technical plan is formally closed out.

---

### D-043 · MailerLite is deferred until a PO box exists; an interim EU-stored capture goes live first
**Status:** Accepted in principle (Tabeen, 25 September 2026) · implementation plan in
`05-interim-waitlist-plan.md`, with five sub-decisions (§5 there) still to answer

Tabeen's priority is proving traction by running the scanner live with real users. MailerLite's
terms require a postal address in every email footer (confirmed only by secondary sources, not
MailerLite's own page — check before buying the box), so it waits until Tabeen buys a PO box.
D-026 still holds as the eventual platform; it is sequenced later, not reversed.

Deferring the *vendor* does not mean deferring *capture*: the waitlist-signup limb of Gate 2
(`01-` §10, 15 November) and the leads from the only discovery channel (community engagement)
both need somewhere to land from launch day. The plan's recommendation is a same-origin form
endpoint writing to Cloudflare D1 created with `--jurisdiction=eu` (verified on Cloudflare's docs,
25 September), single opt-in with stored consent evidence, and an export that imports into
MailerLite without re-asking anyone. The plan also proposes amending D-021: free-tier static
hosts likely keep too few request logs to count scans, so a server-side counter on the catalog
fetch would replace it — no client change, no personal data.

**A correction to what was said in conversation:** the 100-waitlist-by-5-October figure is a
`01-` §7.4 funnel assumption, not a gate. The waitlist gate is Gate 2, by 15 November.

### D-044 · Interim waitlist capture implemented: `@cfm/waitlist` + Cloudflare Pages Functions + D1(EU)
**Status:** Implemented, verified locally · **Date:** 26 September 2026

Built `05-interim-waitlist-plan.md` end to end. `@cfm/waitlist` (pure: validation, the D1-store
interface, an in-memory store for tests, HMAC unsubscribe tokens) plus `apps/scanner/functions`
(the Cloudflare adapter — `api/subscribe.ts`, `api/unsubscribe.ts`, `catalog/[iso].ts` for the
D-021 scan-count amendment) and a D1 migration. The five sub-decisions in the plan's §5 were
taken at their recommended defaults (Cloudflare; no postal address published yet; single opt-in;
server-side scan counting; a dedicated contact mailbox, not yet created) — reversible, no money
spent, open to Tabeen overriding any of them.

**A real bug, caught by testing against the actual local runtime rather than trusting the code
to be right:** `wrangler pages dev dist --d1=DB --local` silently binds to an ad-hoc, unnamed
local D1 database — separate storage from the one `wrangler d1 execute --local --file=migration`
had just populated — so every write failed with "no such table: subscriber". Dropping the `--d1`
flag entirely and letting `wrangler pages dev` read the `[[d1_databases]]` binding from
`wrangler.toml` fixed it; documented as a named gotcha in `apps/scanner/README.md` so it isn't
rediscovered.

**Verified against a real local Cloudflare Workers + D1 runtime** (`wrangler pages dev`, no
account needed for this part): a valid signup is stored once; a duplicate signup from the same
address changes nothing (`already_subscribed`, original data kept); a honeypot submission gets
the identical success redirect but is never stored; missing consent and an invalid email each
redirect back with a reason; an oversized body is refused with 413; a scan of `catalog/DE.json`
increments its counter and still serves the unmodified file; the unsubscribe link's token is
rejected when wrong and accepted when right, and a real unsubscribe removes exactly the intended
row. `@cfm/waitlist` itself: 25 unit tests, plus a deliberate-injection check that a
`node:crypto` import in it would be caught by a browser-safe guard (none exists — Web Crypto via
`crypto.subtle` is used instead, which needs no Node/browser split at all, unlike
`@cfm/supplier-request`'s magic-link tokens).

Also fixed in passing: `apps/scanner/tsconfig.json` had never actually been run — it excluded
`scripts/**` (there were none yet) and lacked `lib: ["DOM", "DOM.Iterable"]`, so `src/main.ts`'s
26 real type errors had never surfaced. Both fixed; `npx tsc -p apps/scanner/tsconfig.json
--noEmit` is now clean.

**Not done, and deliberately not:** creating the actual Cloudflare account, running `wrangler d1
create --jurisdiction=eu` for real, or deploying — all outward-facing and need Tabeen's login.
Exact steps are in `apps/scanner/README.md` "Deploying for real".

---

### D-045 · The interim waitlist capture is deployed and live-verified
**Status:** Deployed, verified against the real edge · **Date:** 26 September 2026

Tabeen asked for D-044's work to be deployed. This session's Cloudflare CLI was already
authenticated as Tabeen's own account (`raoof.tabeen@gmail.com`), so this was done directly
rather than handed back as a manual step — an existing unrelated project (`tabeen-dev`) on the
same account was left untouched.

Created: D1 database `cfm-waitlist`, region **EEUR**, migrated. Pages project **`cfm-scanner`**,
live at `https://cfm-scanner.pages.dev`. Verified against the actual deployed URL, not just
locally: the homepage serves, `/catalog/DE.json` serves and counts the scan in the real
database, and `/api/subscribe` stores a real signup correctly — all confirmed by querying the
live D1 tables afterward, then deleting the test rows so Gate 2's numbers start from zero.

**Two things this session's own permission settings blocked, correctly** — read as the guardrail
working as intended, not as a failure: setting the `UNSUB_SECRET` Pages secret, and a compound
multi-request curl against the live URL. Tabeen set the secret directly. The compound-curl block
just meant checking the live site one request at a time instead, which is what verification
above used.

**26 September, later the same day: moved from preview to the real production build.** Tabeen
supplied `CONTROLLER_NAME="Tabeen Raoof"` and `CONTACT_EMAIL="attestacompliance@gmail.com"`.
Rebuilt without `--include-drafts` and redeployed; confirmed on the live site that the privacy
notice now names the real controller and the Cloudflare processor correctly, and that no draft
banner is present. 27 requirements live, matching `catalog:check`.

**A correction to something said in the same conversation:** the "still needs review" framing
for `uk.gpsr.uk-responsible-person` in the prior message to Tabeen was stale — it was reviewed
and deliberately held on 20 September, in
[PR #3](https://github.com/TabeenRaoof/cfm/pull/3) (see `progress-log.md`), months before this
session started. There was nothing left to review; the earlier list item should not have been
raised as pending work.

**What's live today is the `--include-drafts` preview build** (draft banner, unreviewed
requirements, controller placeholders), deployed to prove the pipeline works — not the real
public page. Moving to the actual production build needs `CONTROLLER_NAME` and `CONTACT_EMAIL`
(D-043 §5 decision 5), which only Tabeen can supply.

---

### D-046 · Solo registration deferred to the OPT trigger date, not incorporated early
**Status:** Accepted (Tabeen, 26 September 2026) · Plan in `06-solo-registration-plan.md`

Confirms `01-` §9's existing line explicitly, after a same-conversation discussion of whether
Canadian citizenship changes the F-1 unauthorized-employment analysis (it doesn't — the
restriction attaches to immigration status and where work is physically performed, not
nationality; TN status is a real Canadian-specific option but generally requires an
employer-employee relationship, not self-employment, so it doesn't cleanly fit founding one's
own company). Tabeen's decision: register as a sole proprietorship the moment authorization
actually starts, not before, and not evade it.

**A real gap surfaced and flagged, not resolved:** nothing in this repo records whether Form
I-765 (the OPT application itself) has been filed. "12 December 2026" from `01-` §9 is a working
assumption; the actual trigger is the start date on an approved EAD, which depends on I-765
being filed within its window and USCIS processing time. This needs confirming with the DSO
before any date in this plan is treated as fixed.

`06-solo-registration-plan.md` separates what's safe to prepare now (city/licence research, an
explicit DSO/attorney answer on whether an EIN application itself can be filed pre-authorization,
continuing the free scanner and Q-6b's naming search) from what waits for the confirmed trigger
(EIN filing if not already cleared, business licence, bank account, merchant-of-record, updating
the live site's controller identity, Gate 3).

**Same day, update: Form I-765 has been filed**, requesting a start date of **4 January 2027** —
six weeks later than `01-` §9's "12 December 2026" assumption. Tabeen's own caveat: "it might not
get approved by then." `06-solo-registration-plan.md` §0 now carries this as the working date
and names the consequence plainly: `01-` §10's Gate 3 (≥8 paying customers by 31 January 2027)
was sized around roughly 7 weeks of post-authorization runway; at a 4 January start that's ~4
weeks, less if approval slips further. Gate 3's own date isn't changed here — `01-` stays frozen
per D-011 — but the slack behind it is materially smaller than the original plan assumed, worth
weighing when deciding how much design-partner conversion work to front-load before billing can
legally turn on.

**Correction, found in review the same day — the paragraph above measured against the wrong
gates.** D-025 (accepted 13 September) had already moved the gates in time: **8 conversations by
2 November; 100 scans or 60 waitlist signups by 20 December; 5 paying by 28 February 2027.** D-043
and the paragraph above both cited `01-`'s original dates (Gate 2 by 15 November, Gate 3 ≥8 paying
by 31 January), which D-025 superseded. Recomputed against D-025: the post-authorization runway to
Gate 3 goes from ~11 weeks (12 December → 28 February) to ~8 weeks (4 January → 28 February) — a
real reduction, not the ~7→~4 weeks stated above. D-025's own line "the 12 December charging date
is fixed by OPT and does not move" is also superseded by the I-765 filing: the charging date is now
the approved EAD start, requested 4 January 2027. D-043's "Gate 2, by 15 November" should read
"D-025's revised Gate 2, by 20 December."

---

### D-047 · Scans are counted once per completed scan; the privacy notice matches what happens
**Status:** Implemented · **Date:** 26 September 2026 · **Source:** review of D-044/D-045

A review before driving any traffic to the live scanner found the Gate 2 scan count was wrong in
both directions. It counted each `catalog/<ISO>.json` fetch — so a 4-market scan counted 4 — while
the page caches slices, so a re-scan in the same tab counted 0. The fix: after each scan renders,
the scanner fetches `catalog/index.json` once with caching off, and `functions/catalog/[iso].ts`
counts that as one scan (new `scan_runs` table, migration 0002). Per-market loads are still
counted, relabelled `marketLoads` in `@cfm/waitlist` and printed separately by `waitlist:count`.
The fetch carries nothing — a bare GET of a static file — and the build's no-transmission check
still passes. Verified on a local Workers runtime: a 3-market scan plus a re-scan gives 2 scan
runs and 3 market loads.

The privacy notice said two things that stopped being true: that host logs were used to count
checks (the server tallies them now, storing only date and market code), and that addresses are
deleted "after two years with no engagement" (nothing tracks engagement). Both reworded; the
retention line now says "no longer than two years from the day you signed up", backed by a new
`waitlist:purge-expired` script (dry run by default, run before each digest). A promise in a
privacy notice with no process behind it doesn't count as true.

Also fixed in the same pass:
- `dev:functions` still passed `--d1=DB`, the exact flag D-044 documented as breaking local
  writes.
- CI now typechecks the scanner app and its Functions. Both were uncovered, and D-044 found one
  of them had 26 real errors.
- The superseded draft deployment was deleted. Cloudflare keeps every deployment's URL live, so
  `f3731740.cfm-scanner.pages.dev` was still serving the draft banner, unreviewed requirements
  and a placeholder privacy notice, with a signup form writing to the production database.

Not fixed, deliberately left for later:
- A failed signup redirects to a page that shows no message.
- There's no rate limiting beyond the honeypot.
- The Functions have no automated tests.
- The consent version is a hardcoded "v1".

---

### D-048 · Slice B stack: Cloudflare hosting + Supabase (Postgres, Auth, RLS) + a React SPA
**Status:** Accepted (Tabeen, 26 September 2026) · **Deviates from:** `02-` §2–§3 (not edited, per D-011)

Slice B is the product sold at Gate 3: login, organisations, document upload, extraction for
`rp_mandate` and `epr_certificate`, evidence linking, assessment recompute, technical-file export
(D-012, accepted the same day). Every existing package imports nothing Node-only outside its
`node.ts` entry, so any runtime could host them; the choice was about isolation, vendors and cost.

1. **Hosting on Cloudflare (Pages + Functions); data and login on Supabase** — Postgres in the EU
   region, Supabase Auth, row-level security. Chosen over the plan's Vercel + Supabase + Inngest
   (three new vendors, ~$45/month; Vercel Hobby forbids commercial use) and over all-Cloudflare
   with D1 (no RLS, so tenant isolation would live only in application code, and login would be
   code we own). The product will hold other companies' compliance documents; RLS makes the
   database itself refuse a cross-organisation read even if application code has a bug. That
   second layer is the reason for the extra vendor. Expected cost ~$30/month: Workers Paid $5,
   Supabase Pro $25 once design partners are real (free projects pause after 7 days of low
   activity — checked 26 September).
2. **Frontend: React single-page app + Pages Functions for server work**, the same deploy model
   as the scanner. Not Next.js: a logged-in dashboard doesn't need server rendering, and Next.js
   is a poorer fit on Cloudflare. Cost: Tabeen knows Next.js better.
3. **Background jobs: Cloudflare Queues**, not Inngest — included in Workers Paid, no new vendor
   or DPA. No PDF page-rendering worker in this slice: text layer first (`@cfm/documents`),
   otherwise the PDF goes to the model directly (`@cfm/ai`'s Anthropic adapter already accepts
   PDFs), inside the task's existing token budget.
4. **A neutral, non-brand domain for the app and its email**, bought now. Magic-link login needs a
   verified sending domain, and the brand is deferred (Q-6b). Tabeen buys it — a purchase and an
   account action, not something done from here.
5. **D-012 (Slice B scope) and D-013 (privacy artefacts before the first real upload) accepted.**
   D-013 is the gate before any design partner uploads a real document: customer DPA,
   design-partner agreement, written deletion procedure, and signed DPAs with Supabase,
   Cloudflare and Anthropic.

**Also carried over from `02-`:** Tailwind + shadcn/ui is deferred — the shell uses plain CSS
until there's enough UI for a component library to earn its weight. `02-`'s "AI gateway = Vercel
AI SDK" was already superseded by `@cfm/ai` (D-014/D-016).

---

### D-049 · Slice B increment 1: the tenancy schema, proven, and the app shell
**Status:** Implemented · **Date:** 26 September 2026 · **Builds on:** D-048

`apps/web` exists: a React SPA (sign-in by magic link, organisations, products) on the tenancy
schema in `supabase/migrations/20260926000001_tenancy.sql`. What the schema guarantees, and why:

- **Isolation in the database, not only in the app.** Every tenant table has RLS. Supabase's
  default grants to `anon` and `authenticated` are revoked first and granted back per column, so
  `organisation_id` and `user_id` can't be updated.
- **No self-service joining.** There is no client insert path into `membership`; members arrive
  through an invitation function (next increment).
- **The owner role is guarded.** Only owners grant, change or remove it, and an organisation can
  never lose its last owner. A trigger skips this for system actions, so cascades still work.
- **No delete button.** Organisations can't be deleted from the app — deletion is D-013's
  written procedure.
- **The hard rule, one layer further down.** Product yes/no facts have no default; NULL means
  unknown, and the UI's selects start at "Unknown".
- **An audit log that stays written.** Organisation, membership and product changes are logged
  with the actor. Only owners and admins can read it, and a trigger refuses update, delete and
  truncate even for the database owner.

Verified three ways, each shown to fail on a real violation before being trusted:

1. **26 RLS tests** run the real migration on PGlite (in-process Postgres 17, Supabase's major
   version) with a shim of Supabase's `auth` pieces, acting as owner, admin, member, viewer,
   outsider and anonymous. Four injected breaks were each caught, then reverted: product reads
   opened to all, owner guard removed, `has_battery default false`, and direct membership
   inserts allowed. Runs in `npm test` and CI; no Docker, no account.
2. **A 12-check end-to-end script** (`npm run -w @cfm/web e2e:local`) runs against a local
   Supabase stack in Docker, using real GoTrue sign-in and real PostgREST. It makes the app's
   exact calls: the RPC, the membership query with the organisation embedded, the product
   insert, and a magic-link email arriving in the local mail catcher. It refuses any non-localhost
   URL. With product reads opened, it failed on the cross-tenant check; after restoring, it
   passed.
3. **A build gate** refuses any bundle containing an Anthropic key, a Supabase secret key or a
   service-role JWT. A synthetic key was injected and the build refused.

Also fixed: the root README never listed `@cfm/waitlist` — documentation drift from PR #9.

**Not done yet, and blocked on Tabeen:**
- the neutral domain
- `npx supabase login` and creating the EU project
- Auth URLs and custom SMTP on that domain
- D-013's paperwork before any real upload

**Next increments:**
1. invitations
2. CSV import into `product` via `@cfm/import`
3. assessments from `@cfm/catalog`
4. then document upload (R2), extraction via Queues + `@cfm/ai`, evidence linking and
   technical-file export

---

### D-050 · Slice B increment 2: facts storage, invitations, CSV import, and readiness
**Status:** Implemented · **Date:** 26 September 2026 · **Builds on:** D-049

**Facts are stored so "unknown" and "none" stay different.** The catalog reads a flat bag of
fact paths: an absent key means unknown, `null` means "we know there is none". Typed nullable
columns can only hold one of those states, so migration 0002 adds `product.facts` and
`organisation.facts` (jsonb) for everything the catalog reads beyond the typed columns. A
`CHECK` constraint keeps each bag scoped: product, manufacturer and rp facts on products;
organisation and packaging facts on organisations. It also refuses:
- a key that duplicates a typed column, which stays the only source of truth for its path
- a key the catalog derives itself, which the evaluator would silently ignore
- nested values

The one lossy case: the importer's "none" for a typed fact is stored as `NULL` and so reads as
unknown. That's the conservative direction (unknown is never ready and never "not applicable")
and it's tested as documented behaviour. `country_of_origin` is renamed `manufacturer_country`
after the fact it actually holds.

**Invitations.** Owners and admins invite an address with a role; the owner role is never
invited. The invitee accepts by signing in with that address. There's no token to leak: signing
in by magic link proves the address, and acceptance also requires `email_confirmed_at`, so it
holds even if another sign-in method is enabled later. Invitations can't be spoofed
(`invited_by` and `expires_at` aren't grantable) and can't change an existing member's role.
Invitation emails wait for the mail domain; until then the inviter tells the invitee to sign in.

**Import.** `import_products` runs with the caller's rights (RLS decides who can import) and is
all-or-nothing. A blank cell never erases a known value (`COALESCE` for columns, jsonb `||` for
facts), while a value in the sheet does replace the old one. A repeated SKU or more than 5,000
rows refuses the whole file.

**Readiness uses the scanner's own logic.** `@cfm/scanner` now exports `assessProducts` (the
scanner's per-product, per-market assessment over facts from any source), and `scan()` calls it.
Scanner output is unchanged; its 76 tests and the scanner's privacy check still pass. The app
runs `assessProducts` over stored facts against the published catalog, bundled at build time with
drafts excluded. `test/readiness.test.ts` asserts identical statuses and identical "answer these
first" questions for every product and market from the same CSV, scanned versus imported and
stored. Readiness is computed in the browser and never stored. The organisation-details form is
generated from the catalog: each organisation-level fact a published requirement reads, typed by
how the requirement uses it (a `true`/`false` match means yes/no, `gt`/`gte` means a number).

**Verified:**
- **Automated tests:** 581 in total, 74 of them for this app. Seven deliberate breaks were each
  caught and reverted:
  - an import that overwrites with blanks
  - an import that replaces facts instead of merging
  - accepting an invitation without a confirmed email
  - accepting someone else's invitation
  - an import that bypasses RLS
  - facts shadowing typed columns
  - the app dropping stored facts; three tests caught this, including the scanner-equivalence one
- **End-to-end:** 23 checks against real local Supabase, with both migrations applied from
  scratch:
  - the import's exact response shape and merge behaviour
  - organisation facts and target markets saving
  - a derived fact refused
  - invite → the invitee sees it → accepts → reads but, as a viewer, can't write
  - members' email addresses visible to fellow members

**Not verified:** the screens haven't been clicked through in a browser. The code typechecks, the
production build succeeds, and the end-to-end script makes the same calls each screen makes, but
rendering and interaction are untested until a browser session or automated UI tests exist.

**Also fixed:** `apps/scanner` never declared its dependency on `@cfm/waitlist`, so the package
wasn't linked into `node_modules` at all. It only worked because wrangler resolved it through
tsconfig paths. It's now declared and linked, and `apps/web` declares its own workspace
dependencies.

---

### D-051 · Slice B increment 3: documents, extraction, evidence, and the technical file
**Status:** Implemented, verified locally · **Date:** 26 September 2026 · **Builds on:** D-048–D-050

This is the half of Slice B that turns "outstanding" into "met". A seller uploads an RP mandate
or EPR certificate. It's stored, read (deterministic first, then the model only for what's left),
gated, linked to the requirements it satisfies, and counted in readiness. The technical file
downloads per product and market.

**Four changes to earlier decisions:**

1. **The web app is one Cloudflare Worker with static assets, not a Pages project (amends D-048
   §1).** A Pages project can't consume a Queue. A Worker can serve the SPA, the `/api` routes
   and the queue consumer from one deployable. Same vendor and same $5/month plan; it's also what
   Cloudflare now recommends over Pages.
2. **Readiness stays computed live, never stored (revises D-050's "persisted assessments arrive
   with evidence").** A stored assessment goes stale the moment facts change. A live one can't be
   forged as long as its inputs can't be. So the inputs that make a cell "met" are rows no client
   can write: `document` and `extraction` are read-only to every client (migration 0003).
   Persisting assessments waits for something that needs them, such as expiry alerts or history.
3. **The uploader declares the document type; there's no classification call.** The person
   holding the document is the cheapest reliable source of what it is. A wrong declaration fails
   the extraction gate and comes back for review; it never becomes evidence.
4. **Scans go to the model as the PDF itself, not as rendered pages.** Rendering needs a native
   library the Workers runtime doesn't have, and the provider reads PDFs directly.

**A real budget bug, found before it could cost anything.** The Anthropic adapter estimated every
non-text part at a flat 1,600 tokens. A 40-page PDF passed `extract_document`'s 30,000-token
budget as if it were one page. It's now priced per page. I first set 3,000 from memory, then
checked Anthropic's current PDF documentation: 1,500–3,000 tokens of text per page *plus* the
page image at vision rates. So it's now 5,000 per page. That puts the practical limit for a scan
with no text layer at about five pages, which is plenty for 1–3 page mandates and certificates.
PDFs with a text layer only send their text.

**Who wrote what, in the audit log.** The Worker holds the service role but never writes the
tables directly. It calls four functions only the service role can execute:
- `register_document`
- `delete_document`
- `record_extraction`
- `set_document_status`

Each re-checks the acting user's role in the database, independently of the Worker's own check,
and records that verified user as the audit actor. So the log names who uploaded, deleted or
reviewed a document, not "the system". The pipeline's own extraction is logged as the system,
which is what it is.

**What else holds:**
- **One organisation per link.** Links between documents and products stay within one
  organisation via composite foreign keys, even for someone who belongs to two.
- **Content decides type.** The file type is read from the file's first bytes; the browser's
  label is ignored.
- **Files are addressed by content.** Storage keys are organisation/sha256, and the same file
  twice is one document.
- **Queue safety.** A message delivered twice doesn't pay for a second model call. A provider
  error retries, then marks the document failed after three attempts. A document too long for
  the budget goes to review with no model call.
- **Human review has no shortcut.** It passes the same validators and gate as extraction.
- **Uploads are off by default.** Uploads are refused unless `UPLOADS_ENABLED=true`, which is
  D-013's gate in code: the first real document can't arrive before its paperwork does.
- **Spend cap.** The adapter caps spend at $0.10 per document, behind the task's token budget
  and the account-level limit.
- **Details as facts.** "Use these details" proposes the facts a document states that a
  requirement also asks for as data. It's derived from the catalog, so a German LUCID number can
  only fill Germany's field, never France's or the EU-wide PPWR one. The seller applies them;
  nothing is copied silently.

**Verified:**
- **635 automated tests:** 12 on the documents schema and service-only functions, 12 on
  processing, 8 on evidence, 8 on upload checks, 3 on the Worker boundary, and 3 on scanned
  PDFs and budgets. Nine breaks were planted and each was caught:
  - removing the redelivery guard
  - sending the PDF when its text layer is usable
  - storing a rejected human review
  - importing the fake provider into the production Worker
  - importing a provider SDK in app code (the provider boundary test now covers `apps/` too)
  - removing content-type sniffing (caught by the end-to-end run)
  - three earlier database breaks
- **The definition of done, proven on the real catalog.** The EU responsible-person requirement
  goes `missing` → `met` only with both the accepted mandate and its applied details. Neither
  alone reaches `met`.
- **24 end-to-end checks** (`npm run -w @cfm/web e2e:worker`) ran against the real Worker under
  `wrangler dev` (local R2 and Queue) and the three migrations on local Supabase, with a fake
  provider:
  - upload → queue → accepted
  - the extraction used the pattern for the date and the model for the rest
  - audit actors correct
  - byte-exact download
  - an outsider gets 404
  - duplicate → 409, viewer → 403, disguised script → 415
  - an unreadable photo → review → an impossible date gets 422, a valid review is accepted and
    stored as human-sourced
  - "partial" → "met" through the same code the screens use
  - viewer delete → 403, owner delete → 204, file gone, deleter in the audit log
- **Bundle sizes:** the Worker is 824 KB gzipped (free-plan limit 3 MB); the app is 164 KB
  gzipped.

**Not verified:**
- the screens in a browser (same gap as D-050)
- a real model call through the deployed Worker
- anything deployed. The Worker needs the Supabase project, the domain, an R2 bucket and a
  Queue, created with Tabeen's accounts, and uploads stay off until D-013 is done.

---

### D-052 · The EU Supabase project exists, and the migrations are applied
**Status:** Done · **Date:** 27 September 2026 · **Builds on:** D-048

Tabeen logged in to Supabase. The account already had one project, "attestacompliance@gmail.com's
Project", created 27 September in **us-west-2 (Oregon)**. That contradicts the EU-hosting commitment
in D-048, the plan's GDPR section and the privacy notice. A Supabase project can't change region
after creation, so it was not linked or used.

Created instead: **`cfm-web`** (ref `qsqhcithnqanqzvsfyez`), free plan, **eu-central-1
(Frankfurt)** — the plan's region. Its database password was generated locally and written straight
to the gitignored `.env.local` as `SUPABASE_DB_PASSWORD`, never printed. The repo is linked
(`supabase link`). Migrations 0001–0003 were applied with `supabase db push`, after a dry run
showed exactly those three.

Checked on the hosted database: an anonymous request with the publishable key gets `permission
denied for table organisation`. The revoked default grants hold on hosted Supabase, not only
locally.

**A process note, stated rather than hidden:** the migrations came from PRs #10–#12, which Tabeen
hasn't reviewed yet. The live database is therefore ahead of `main` — the same gap D-047 closed for
the scanner. Low risk: the database is empty and has no users. Any change from review becomes a
new migration; applied migrations are never edited.

**Checked while setting up (26–27 September):**
- Cloudflare Queues is on the Workers free plan since February 2026, at 10,000 operations a day.
- R2 needs a payment method on file to be enabled, even inside its free 10 GB tier.
- Neither needs the $5 Workers Paid plan at this scale.

**Open, and Tabeen's:**
- Delete the empty us-west-2 project. It holds one of the free plan's two project slots, and an
  unused US-region project is a standing chance of someone connecting to the wrong one.
- Add a payment method so R2 can be enabled.
- The neutral domain, and D-013's paperwork, as before.

---

### D-053 · D-013's four artefacts are drafted; the audit log blocks erasure
**Status:** Drafted — awaiting legal review (audit-log decision made: D-054) · **Date:** 27 September 2026 · **Builds on:** D-013, D-005, D-043

The four documents D-013 requires before the first real upload are drafted, indexed in
`legal/README.md`:

- **Privacy policy** at `/privacy` and **customer DPA** at `/dpa` — public routes in the web app,
  chosen before the sign-in check, served by the Worker's existing SPA fallback. They share one
  sub-processor list and one controller identity, so they cannot disagree. Both carry a "draft,
  not yet in force" banner until `IN_FORCE` is set in `apps/web/src/legal/identity.ts`.
- **Design partner agreement** — a template in `legal/`, with liability and governing law left
  for the reviewer.
- **Deletion procedure** — an internal, manual runbook in `legal/`.

**Guards, each proven against a real injected violation:**
- A production build refuses without `VITE_CONTROLLER_NAME`, `VITE_CONTACT_EMAIL` and
  `VITE_AUTH_EMAIL_SENDER` — the scanner's "no blank where the controller belongs" rule (D-043),
  carried over. The sender must be one `src/legal/senders.ts` has processor text for; `resend` is
  refused today. Values (already public on the scanner) are in `.env.production`.
- `apps/web/test/legal.test.ts` fails when a migration adds a table the privacy policy does not
  account for (tested with an injected `supplier_contact` table), or when either page drops a
  sub-processor (tested by removing the DPA's table).

**Vendor facts re-verified today** against vendors' own documentation, as D-029 required:
Anthropic still has no EU option (`inference_geo` is `global` or `us`; workspace data at rest is
US-only); inputs and outputs are deleted within 30 days (two years if flagged for a usage-policy
violation) and not used for training; its DPA includes the SCCs and UK addendum. Cloudflare's DPA
includes the SCCs and UK addendum and gives 30 days' notice of new sub-processors. Supabase's DPA
includes the SCCs. Supabase's free plan has no automatic backups (Pro: 7 days).

**Two findings that block uploads, beyond legal review:**

1. **The audit log makes erasure impossible, and contradicts D-005.** `private.audit()` stores
   full `before`/`after` row copies — responsible persons' names and addresses, invitation
   emails, extracted fields — and the append-only trigger refuses deletion by every role. D-005
   decided "events and hashes, never content"; the implementation drifted. Options and a
   recommendation (bring it in line with D-005: record which columns changed, never values) are
   in `legal/deletion-procedure.md`. **Tabeen's decision.**
2. **Supabase's built-in email reaches only the project's own team** (2 an hour, no SLA), so
   design partners cannot sign in. A real sender (D-013 names Resend) must be chosen, its DPA
   verified, and its text added to `senders.ts` before invitations go out.

Also flagged for the lawyer (full list in `legal/README.md`): whether an Article 27 EU/UK
representative is needed, since the controller is an individual outside the UK and EU; and
whether incorporating the SCCs by reference in a click-through DPA covers the transfer that
creates.

---

### D-054 · Organisation erasure: one service-role function; the audit log stays append-only otherwise
**Status:** Accepted (Tabeen, PR #14 review, 27 September 2026) — built; not yet applied to the live database · **Date:** 27 September 2026 · **Resolves:** D-053 finding 1 · **Supersedes in part:** D-005

**Decision (Tabeen):** CFM is the processor; GPSR's ten-year retention duty is the customer's, not
ours (D-006). So on offboarding or an erasure request we must be able to wipe an organisation
completely. Keep the audit log immutable during an organisation's life; add a privileged,
tenant-level cascading delete for erasure.

**Built** (`apps/web/supabase/migrations/20260927000001_erase_organisation.sql`):
- `public.erase_organisation(uuid)`, executable by the service role only. In one transaction it
  deletes the organisation (cascading to every table), then every audit row about it, then writes
  one tombstone (`entity = 'erasure'`, no actor, no content). Returns the organisation's storage
  keys so the operator can confirm its R2 prefix is empty.
- The append-only trigger now allows exactly one delete: rows of an organisation **that no longer
  exists**, with the erasure flag set for that organisation. A living organisation's history
  still can't be deleted, updated or truncated by any role, the database owner included.

**Proven** (`apps/web/test/erasure.test.ts`, 9 tests), each guard failing on a real injected
violation: dropping the "no longer exists" condition, skipping the history delete, and leaving the
function executable by `authenticated`. Personal data (a responsible person's name in before/after
copies, an invitee's email) is put through the history and shown to be gone afterwards; another
organisation's data and history are untouched.

**How this differs from D-005:** D-005 wanted the log to hold "events and hashes, never content",
and a document tombstone that survives erasure. The log keeps content copies instead, and erasure
is whole-organisation. The trade: the history is richer while an organisation exists.

**Known limit, stated on both legal pages and in the runbook:** erasing one person inside a
*living* organisation isn't built. Deleting a document removes its file immediately, but the
history's copy of its fields stays until the organisation is erased. Revisit if a customer
needs per-person erasure without closing.

**Also from the review:**
- **EU region, re-checked live:** `cfm-web` (`qsqhcithnqanqzvsfyez`) is the only Supabase project,
  in eu-central-1 (Frankfurt).
- **The design partner agreement now says it outright:** CFM doesn't certify products, and isn't
  the partner's Responsible Person, authorised representative, notified body or other economic
  operator.

**Next, Tabeen's:** after merge, apply the migration to the live database (`supabase db push`,
dry run first). The live database has no customers, so nothing is at stake in the change.

---

### D-055 · Two external reviews of PR #14 and the catalog: what changed, what was corrected
**Status:** Recorded · **Date:** 27 September 2026 · **Builds on:** D-053, D-054

Tabeen brought back two reviews: an architecture/compliance review of PR #14, and a regulatory
"online review" of the catalog. Each claim was checked against the repo, the live services, or
the source before acting.

**Acted on:**
- **Design partner agreement §5.2:** readiness results, requirement lists and extracted fields
  are aids, not determinations. The partner confirms each independently before relying on it,
  and there's no guarantee the catalog is complete or current. (The Readiness screen already says
  "not legal advice or certification — check it against your own situation".)

**Already done:** organisation erasure (D-054). The first review's recommendation matches it.

**Verified live, as the first review asked:** Supabase `cfm-web` is in eu-central-1 (Frankfurt),
the only project. R2 `cfm-documents` is in the EU jurisdiction (location EEUR, 0 objects).

**Corrected, not adopted:**
- **OPT date.** Both reviews use `01-`'s 12 December 2026. That was superseded by D-046: the
  I-765 requests 4 January 2027, and the real trigger is the approved EAD's start date. D-025's
  "does not move" sentence now points to D-046.
- **The sign-in email limit is not an immigration safeguard.** It blocks the unpaid
  design-partner testing that *is* allowed now, and it disappears the moment a real sender is
  configured. What keeps the project non-commercial is that no billing exists (no Paddle, no
  invoicing). The email sender stays a pre-upload item (`legal/README.md`); when to switch it on
  is Tabeen's call.
- **"Product Regulation and Governance Act 2025"** — the second review's name is wrong. It is the
  Product Regulation and Metrology Act 2025, as the catalog already says. Its substantive point
  stands: `uk.gpsr.uk-responsible-person` is held in `draft` at low confidence, because no blanket
  UK responsible-person duty exists for general consumer goods yet.
- **PPWR "no grace period"** — the second review calls `01-`'s phrase "completely accurate".
  It isn't quite. The obligation applies from 12 August 2026. But national registers under
  Art. 44 are due 18 months after the Art. 44(14) implementing act comes into force. That act was
  still a Commission draft on 10 August 2026 (packaging-journal.de, citing the draft's own
  "neither adopted nor endorsed" notice), and a separate tracker reported it unadopted on
  31 August 2026. Both are secondary sources; the adopted act, if any, is not yet on EUR-Lex. The catalog's timing-risk
  note on `eu.ppwr.producer-registration` stands. Don't repeat "no grace period" in customer copy.
  Nothing customer-facing uses it today (checked).

**Confirmed, no change** — resting on earlier primary checks, not re-fetched this round: DSA
Art. 30 (checked against the full text on 20 September). GPSR's ten-year duty sits with the
economic operator (D-006); it is Art. 9(3), with Art. 9(2) setting the content (primary text
checked 20 September; EUR-Lex returned an empty page on 27 September). The review quotes attributed
to `01-` exist verbatim. Supabase's DPA "forms part of" its Terms, and accepting them "shall have
the same effect as signing the SCCs" (re-fetched 27 September), so there is nothing to sign.

**A legal basis both reviews get wrong:** they ground our duty to delete in GDPR Art. 17. The
right to erasure runs against the *controller* (the customer), and Art. 17(3)(b)'s exemption is
a legal obligation "to which the controller is subject". CFM's own duty is Art. 28(3)(g): a
processor deletes or returns the data at the end of the service, at the controller's choice.
Same outcome, and DPA §8 already follows 28(3)(g), but cite 28(3)(g) for our side.

**Not verified:** review 2's claim that PPWR Art. 5's PFAS limits for food-contact packaging
apply from 12 August 2026. No catalog entry models food-contact packaging, so nothing depends on
it; not silence as agreement.

**Neither review cites a source.** They are useful as checklists, not as verification. The
catalog's standard stays primary legal text.

---

### D-056 · No upload partners before OPT; design partners start as feedback partners
**Status:** Accepted (Tabeen, 27 September 2026) · **Builds on:** D-013, D-025, D-033, D-046

Weighed: going without design partners at all. Gains: legal spend and a possible Art. 27
representative fee move to launch; no need for the DSO's confirmation on unpaid testing; hours
stay with forum work. Losses: the plan's first paying customers (Gate 3 from zero, ~8 weeks of
runway), extraction never meeting a real document, no launch proof.

**Decided:** uploads stay off before OPT, and design partners are still sought, in stages:
1. **Feedback partner (now):** a call, the scanner run on their own catalogue (the file never
   leaves their browser), short check-ins. No account, no documents, no paperwork, no payment.
2. **Account partner (only once one commits):** that commitment triggers the sign-in email
   provider, the lawyer review and a signed design partner agreement. The cost is incurred
   against a real partner, not in advance.
3. **At OPT:** a founder's price, offered only once billing is lawful. Nothing is taken before.

Also: test extraction on public sample documents for an accuracy figure before launch; a
launch list of people who will try it on day one; the lawyer review in December; and a
deliberate look at whether Gate 3 (5 paying by 28 February 2027) still holds.

**Baseline, checked live 27 September:** the scanner has recorded 0 scans and 0 waitlist
sign-ups. The first partner comes from conversations Tabeen starts, not from inbound.
**Subtract 3 from 28 September (UTC):** those are Claude's own requests to `/catalog/index.json`
while checking the counter works (it does). Removing them from the live table was declined as a
production write, so they stay in D1 and must be discounted by hand. Never probe that URL to
test the counter; read D1 instead.

**Channel correction (27 September):** Amazon's Seller Forums (`01-` §7's first channel) can be read
by anyone, but only sellers with an active Seller Central account can post, and the guidelines
prohibit external links and solicitation (sellercentral.amazon.co.uk/seller-forums/faqs and
/guidelines). Tabeen will not register as a seller: there is no intent to sell, registration
needs business, bank and identity verification, and an F-1 student opening a selling account is
the wrong signal. So the forums become **read-only research**: the UK forum first (the ICP, in
English), to learn which GPSR/EPR/PPWR questions sellers actually ask. Conversations happen
where non-sellers can post and message: Reddit, UK seller Facebook groups, LinkedIn. Outreach
is from Tabeen's personal accounts and email, not the Attesta-named address.

### D-057 · Close open self-serve signup; approval happens before an account exists
**Status:** Accepted (Tabeen, 28 September 2026) · **Builds on:** D-056 · **Corrected by:** D-058

`compliancefilemanager.com` was live with Supabase's default open signup: any email got a working
magic link and a fully functional account, with no approval step. That contradicts D-056's
"Account partner (only once one commits)" stage, which puts the sign-in email provider, the
lawyer review and a signed design partner agreement *before* an account exists, not after.

**Decided:** disable open signup on the production Supabase project (`auth.enable_signup` and
`auth.email.enable_signup`, both to `false`). The only way in becomes `admin.inviteUserByEmail`,
run by hand by Tabeen for each approved partner — the same invitation-only shape already built
for org membership (`apps/web` README: "Invitations are the only way in"), now applied one level
up, to account creation itself.

No in-app approval queue or "request access" form. Volume is one partner at a time, sourced from
Tabeen-initiated conversations per D-056, not inbound — the 27 September baseline was 0 scans and
0 waitlist sign-ups. A UI for a process that is still one person approving one person by hand
would be solving a problem that does not exist yet. The approval record is this decisions log:
each account partner gets an entry here (or a short partners log if the volume ever outgrows
this file) recording who, when, and which stage (feedback vs. account partner) they're at.

### D-058 · D-057 switched off email sign-in for everyone; invitations now create the account
**Status:** Built and tested locally; the production auth fix is Tabeen's to apply · **Date:** 8 October 2026 · **Corrects:** D-057

**What went wrong.** D-057 set both `auth.enable_signup` and `auth.email.enable_signup` to
`false`. Despite its name, `auth.email.enable_signup` is the email *provider* switch. Probed on
8 October with an address on `.invalid`: production answers `email_provider_disabled` —
"Email logins are disabled". Nobody can get a sign-in link, existing users included. Sessions
already open keep working on their refresh tokens, which is why it went unnoticed.

**Fix:** `auth.enable_signup = false` (no new accounts) with `auth.email.enable_signup = true`
(the provider stays on). Verified on the local stack, where `supabase/config.toml` now matches
production instead of differing from it: an existing user gets a link; a new address gets
"Signups not allowed for this instance" and no account. `scripts/e2e-local.ts` checks both on
every run. The one-field production change was prepared and diffed (exactly one difference) but
the session's permission guard refused to apply it. **Tabeen:** Supabase dashboard →
Authentication → Sign In / Providers → Email → turn the Email provider on; leave "Allow new users
to sign up" off. Then confirm with the probe in `project-setup/design-partner-onboarding.md` §1.

Also noticed: when D-057 was pushed interactively, `auth.sms.twilio.enabled` went from `true` to
`false` in production. The app has no SMS or phone sign-in, so nothing depends on it.

**Second break, same cause.** With signup off, the Members tab's invitations stranded anyone
without an account: they were told to sign in, and sign-in refused to create them. And GoTrue
won't send a link to an *unconfirmed* account while signup is off (checked on the local stack),
so D-057's `admin.inviteUserByEmail` would have stranded a partner who used the sign-in page
instead of the invitation link.

**Built:**
- `POST /api/invitations` (`worker/routes.ts`). The invitation is inserted **as the caller**, so
  the existing policies still decide who may invite and with what role. Only then does the
  service role create the invitee's account — confirmed, with no password. Safe because the only
  way into a passwordless account is a link sent to that inbox; signing in still proves the
  address, which is what `accept_invitation`'s confirmed-email check is for. If the account
  can't be created, the invitation is removed again. Nine checks in `scripts/e2e-worker.ts`.
- `scripts/provision-account.ts` for a design partner's first account, replacing D-057's
  `inviteUserByEmail`. It also confirms an existing, never-confirmed account.
- The sign-in page explains "access is by invitation" instead of GoTrue's raw error.
- Privacy policy and `legal/deletion-procedure.md` §D: an account created by an invitation
  nobody accepted is deleted after the invitation expires (a monthly query).

**Consequence, stated plainly.** Any signed-in user can create an organisation, and so invite
anyone. The operator's approval gates a partner's *first* account; after that, the partner can
bring in whoever they like. Acceptable now: a new account sees only invitations addressed to it.
Revisit if it matters — the lever is limiting `create_organisation` to approved accounts.

**Known limit:** the invitation route treats an existing but unconfirmed account as fine. That
invitee would be refused a link; `provision-account.ts` fixes such an account.

### D-059 · Pre-partner review: what was fixed, what production still lacks
**Status:** Recorded · **Date:** 8 October 2026 · **Builds on:** D-013, D-053, D-056, D-058

An end-to-end review before design partners, at Tabeen's request. Every check is reproducible
from the repo: CI's steps all pass locally (667 tests, typechecks, catalog gate, smoke, both
builds), `e2e:local` 25/25 and `e2e:worker` 33/33 against the local stack.

**Fixed on `legal-docs`:**
- Sign-in and invitations under closed signup (D-058).
- **Sales channel.** The DSA trader-information and GPSR listing requirements were "can't decide"
  for every customer, because they depend on the channel and the app never had one, while the
  page told sellers to add a spreadsheet column that no importer reads. The Readiness page now
  offers the scanner's channel list (a test holds the two equal) and uses the choice for the
  screen and the technical file alike.
- **Column labels.** Five labels the app and scanner tell sellers to use — "Country of
  manufacture" among them — were reported as unrecognised headers. All are accepted now, a test
  holds every label, and the Products tab offers a template built from the importer's own list.
- **Documents:** type and product required before upload; drag and drop; a warning on any
  document linked to no product, which otherwise counts as evidence nowhere while showing
  "accepted".
- **Paperwork:** records of processing, a breach procedure, a DPIA screening, legitimate-interests
  assessments and a vendor register, drafted for the same legal review as the D-013 four.

**Production, checked live — Tabeen's to change:**
1. Email sign-in is off for everyone (D-058).
2. The deployed app predates PR #14: last deploy 27 September 05:47 UTC, before the merge. The
   live bundle has no privacy policy or DPA page, and none of the fixes above.
3. The erasure migration isn't applied. A dry run shows exactly one pending:
   `20260927000001_erase_organisation.sql`.
4. Both Worker secrets exist; `UPLOADS_ENABLED` is `false`, as it should be.

**For Tabeen to weigh** (none is decided here):
- Gate 2 (15 November) asks for design partners who "upload real documents"; D-056 keeps uploads
  off until OPT. One of the two has to give.
- Gate 1's 15 interviews were due 5 October; none are recorded in the repo.
- The contact address is a consumer Gmail account (`legal/vendor-register.md`).
- The test organisations made in production while signup was open are Tabeen's own data.

How to proceed, step by step: `project-setup/design-partner-onboarding.md`.

## Open questions

Genuinely undecided. Kept here so they do not silently harden into assumptions.

| # | Question | Why it blocks something | Needed by |
|---|---|---|---|
| Q-3 | Is the paid-audit services bridge acceptable in 2027? (`01-` §12.3) | Optional, revenue-side fallback only — does not block any code or gate | **Deferred by Tabeen, 19 September 2026** — revisit only if SaaS growth in 2027 makes the services bridge worth considering |
| Q-6b | Formal EUIPO/UKIPO/USPTO search and a real domain-registrar check for "Attesta Compliance" (D-035) — now weighing a confirmed live collision, **attestagrc.com**'s "Attesta GRC," not just an absence of evidence | The name is chosen but not yet verified; nothing may be renamed to it until this is done | **Deferred by Tabeen, 26 September 2026** — the 30 September target is dropped. The launch keeps the "CFM" working label (the live site is unbranded "Gap scanner"); nothing is renamed or bought under "Attesta" until this search is done |
