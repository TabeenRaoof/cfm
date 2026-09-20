# Plan Review — business (`01-`) and technical (`02-`)

Review date: 12 September 2026. Reviewer: Claude (Opus 5), at Tabeen's request.

**This document changes nothing.** `01-business-report-...md` and `02-technical-plan-...md` are
treated as immutable inputs and were not edited. Everything below is a delta list: findings, the
evidence for each, and a recommended correction to accept or reject. Where a finding is a
judgement rather than a measurement, it says so.

Working label for the product in this folder: **CFM**. It is a filename convenience, not a
product name and not trademark-checked. See `decisions.md` → D-001.

---

## Verdict

The two plans are unusually good. The business report has already done the hardest thing — it
talked itself out of the obvious product ("a place to store your compliance documents") and
found a narrower wedge that a solo founder can actually hold. The technical plan is internally
consistent, correctly identifies the requirement catalog rather than the AI as the moat, and
makes the right call on almost every vendor.

The problems are **not** in the strategy. They are all in **sequencing**, and they cluster into
one shape: *the plan schedules the thing that proves the plan after the date it is supposed to
prove it.* Five findings (S-1 to S-5) are schedule defects of that kind, and S-1 and S-2 are
the ones that would actually sink the next ninety days.

The second cluster (D-1 to D-9) is design work the plans imply but never state — most
importantly, this project has an obvious domain invariant that nobody has written down yet
(D-1), and it belongs in `AGENTS.md` on day one.

---

## A · Findings that change the schedule

### S-1 · The 12-week build is roughly 3–5× the hours available `[critical]`

`02-` §10.1 lays out twelve weekly deliverables at "roughly 5 hrs/week until December."

The arithmetic:

| | |
|---|---|
| Weeks 1–12 (8 Sept – 30 Nov) at 5 hrs/week | **60 hours** |
| Weeks 13–14 (1–12 Dec), if "then more" means ~20 hrs/week | +40 hours |
| **Total before the 12 December charging date** | **≈ 60–100 hours** |

What §10.1 actually contains: a multi-tenant SaaS with auth and row-level security, CSV import,
an object-storage document pipeline with page rendering, two-model AI routing across three
providers, four extraction schemas with validators, a golden-set eval harness, an evidence-linking
and assessment-recompute engine, a magic-link supplier portal with cron reminders, transactional
email and digests, three export formats including a generated PDF, a public scanner, billing with
plan quotas, and then hardening (RLS tests, backup drill, a 10K-SKU load test, security review,
DPAs signed).

My estimate is 15–40 hours per row for one experienced engineer, so **≈ 250–350 hours**; halve it
generously for AI-assisted coding and it is still **150–200**. That is a judgement, not a
measurement — but it does not need to be precise to make the point, because the gap is not 20%,
it is a multiple.

There is a second, independent reason the date does not move by finding more hours. Playbook
Lesson 4: *total hours do not set the date, the serial chain does.* The chain here is
`schema → catalog evaluator → import → assessment matrix → document pipeline → extraction →
evidence link → recompute → exports`. Every link needs the one before it, and there is one
person. No amount of extra hours parallelises it.

**Recommendation.** Do not try to compress §10.1. Re-cut v1 into two slices with different
purposes, and let everything else become v1.5:

- **Slice A — the Gate-2 slice (weeks 1–6):** catalog v0 + evaluator + CSV import + the public
  scanner + waitlist. No auth, no documents, no AI, no storage, no billing. This is what Gate 2
  is actually measuring, and it is perhaps 30–40 hours.
- **Slice B — the Gate-3 slice (weeks 7–14):** auth, organisations, RLS, document upload,
  extraction for the *two* highest-value document types only (`rp_mandate` and `epr_certificate`
  — both short, both structurally simple, both directly unblock a red cell), evidence linking,
  assessment recompute, and one export (the technical-file PDF).
- **Pushed to v1.5 (Jan–Feb 2027):** supplier portal, remaining extraction schemas, MYC and
  Shopify CSV exports, digests, plan quotas beyond a hard cap.

Slice B is still ambitious for the hours. It is at least *honest* about what has to be true on
12 December: one design partner can produce a technical file. That is §15.4's own bar.

### S-2 · The free scanner is built after the gate it exists to pass `[critical]`

`01-` §10 Gate 2 (by 15 November): "≥150 scanner uses or ≥100 waitlist signups."
`02-` §10.1 week 10 (10–16 November): "Free scanner (public page)."

The scanner ships with **zero to five days** left to accumulate 150 uses. The gate cannot pass as
scheduled, and Gate 2 is the gate that decides whether Gate 3 is worth attempting.

It is also, by some distance, the cheapest item in the table: CSV parse plus the catalog evaluator
plus a public page. No auth, no database writes beyond an email capture, no AI, no storage. The
catalog evaluator is already a week-2 deliverable, so the scanner is days of work sitting on top of
something that exists in week 2.

**Recommendation.** Move the scanner to **weeks 2–3** (15–28 September). That leaves seven weeks
of accumulation before 15 November — about 21 uses a week, which is plausible against `01-` §7.2's
target of five substantive forum answers a week. It also front-loads the only artefact that
generates distribution, which is the thing the business report identifies as the real constraint
("Distribution has to be a machine, not a launch").

### S-3 · Real customer documents arrive six weeks before the privacy artefacts `[critical]`

`02-` §10.1 week 6: "A design partner's SKU goes from red to green by uploading the right docs."
`02-` §10.1 week 12: "DPAs signed." `01-` §9: privacy policy, DPA, deletion workflow.

From week 6, EU and UK businesses upload real test reports and mandates. Those contain personal
data — lab signatories, supplier contacts, named responsible persons. GDPR obligations attach on
the day that data arrives, not on the day money changes hands. The plans have consistently, and
correctly, sequenced the legal artefacts against the **charging** date; the trigger is the
**first real upload** date.

The gate in `02-` §15.4 — "DPAs signed" before charging — is the right list against the wrong event.

**Recommendation.** Split the legal work into two tranches and move the first one forward:

- **Before the first real document upload (week 6):** privacy policy live; customer-facing DPA
  available; DPAs signed with the vendors that will actually touch the data at that point
  (Supabase, Vercel, Cloudflare R2, the AI provider, Resend); a written data-deletion procedure,
  even if it is manual; the design-partner agreement saying what you may do with their documents
  and that they may withdraw them.
- **Before charging (12 December):** Paddle, PostHog, Sentry; the rest of §15.4 unchanged.

The first tranche is a few hours of template work plus signup forms. It is not a reason to delay
week 6, but doing it *after* week 6 is a real exposure with real customers.

### S-4 · Four weeks of build run before the gate that can kill the project `[high]`

Gate 1 closes 5 October — 23 days from today — and its kill condition is real ("brands say the
bureau handles it and they are satisfied"). Meanwhile weeks 1–4 of the build run concurrently.
Neither plan says what happens to that work if Gate 1 fails.

This is not an argument for building nothing. It is an argument for being deliberate about *which*
asset absorbs the pre-Gate-1 hours, because the assets are not equally portable:

| Built before 5 Oct | Survives a Gate-1 kill? |
|---|---|
| Requirement catalog (JSON + sources) | **Yes** — it is publishable content, the basis of a consulting/audit offer, and the seed of the paid change-digest in §5.3 |
| The scanner | **Yes** — a standalone free tool and lead magnet with or without the SaaS |
| Auth, organisations, RLS, billing scaffolding | **No** — pure sunk cost |

**Recommendation.** Weeks 1–4 buy catalog and scanner only. Defer auth and multi-tenancy to after
5 October. This costs nothing if Gate 1 passes (they are not on the critical path to Gate 2) and
saves the whole pre-Gate-1 investment if it does not. It also happens to be exactly the Slice A
cut recommended in S-1, which is why S-1 and S-4 resolve together.

### S-5 · Three AI providers wired in week 4, against zero customers `[medium]`

`02-` §10.1 week 4 wants "classification (Haiku) via gateway with **3 providers wired**." Principle
1 requires that no feature depend on one vendor — but that principle is satisfied by the **seam**,
not by three live adapters. Three adapters in week 4 means maintaining three prompt variants and
three sets of structured-output quirks before a single extraction works end to end, and before the
golden set (week 5) exists to compare them on.

**Recommendation.** Week 4 ships one provider behind the gateway interface, plus a test that
asserts nothing outside `packages/ai` imports a provider SDK. Add the second adapter the week the
eval harness can actually score the swap, and the open-weight route when a price event makes it
matter. Keep model and provider names in config from day one — that is the part that is genuinely
cheap and genuinely load-bearing.

---

## B · Findings that change the design

### D-1 · The project's hard rule has not been written down `[critical]`

`02-` §15.3 defines the statuses: `unknown → missing → pending → partial → met → expired → na`,
and "only `met` and `na` count toward market-ready."

`applies_when` (§5.1) evaluates against product attributes — `manufacturer.country_in_eu`,
`is_toy`, `has_battery`, `materials[]`. Every one of those can be **absent**, because the customer
imported a CSV that did not have the column. The plans never say what the evaluator does when an
`applies_when` clause cannot be resolved.

There are only two possible behaviours, and one of them destroys the product:

- Treat unresolvable as **not applicable** → the requirement silently disappears from the matrix,
  the SKU shows green, the customer ships, the listing is suppressed, and the one thing they paid
  for is the thing that failed. This is `01-` §11's "a wrong readiness verdict causes a customer
  loss," and it is worse than a missing feature because it is confidently wrong.
- Treat unresolvable as **unknown**, never counted as ready, surfaced as "we need to know X about
  this SKU" → the product looks less impressive on day one and is trustworthy.

Every product that asserts something a customer acts on has one sentence of this shape, and it
belongs at the top of the instruction file rather than in a design note. CFM's:

> **A requirement whose applicability cannot be determined from known data is never `na`. It is
> `unknown`, and `unknown` is never counted toward market-ready.**

**Recommendation.** Adopt it as the hard rule, put it in the `tabeen_AGENTS.md` standing rules and
refusal list, and give the evaluator a unit test per requirement that feeds it a product with the deciding
attribute missing and asserts `unknown`. Recorded as D-002.

### D-2 · Tenant isolation is scheduled as hardening; it is a schema property `[high]`

`02-` §9 says "policies tested in CI." §10.1 puts RLS policies in week 1 but **RLS tests** in
week 12, under "Hardening."

Cross-tenant leakage is the single bug class that ends a B2B company outright, and it is a bug you
find by writing the test, never by looking at the policy. A policy written in week 1 and first
tested in week 12 has eleven weeks of tables added under it — including, from week 6, tables
holding other companies' confidential supplier documents.

**Recommendation.** RLS tests move to week 1 and become part of the definition of done: *a new
table is not done until a test proves organisation A cannot read organisation B's rows in it.*
This is the second standing rule in `tabeen_AGENTS.md`. Recorded as D-003.

### D-3 · "≥90% field accuracy" has no denominator `[medium]`

`02-` §10.1 week 5. Playbook Part 1: *a requirement stated as a percentage needs a denominator
before it can be planned against.*

Ninety per cent of what? All fields or required fields? Exact match or normalised? Averaged per
document or per field? It matters a great deal: an aggregate of 92% comfortably hides
`issue_date` at 100% and `standards[]` at 40% — and `standards[]` is the field the entire v2
verification module (§7, standard-version currency) depends on.

**Recommendation.** Define it before week 5 as: *per-field exact match after normalisation
(dates to ISO, whitespace and case folded, standard codes canonicalised), reported **per field**,
on required fields only, over the golden set.* Ship no prompt change that lowers any individual
field. Recorded as D-004.

### D-4 · `document` is "immutable" and GDPR grants erasure `[medium]`

`02-` §4 calls `document` the "immutable original"; §9 requires a data-subject deletion workflow
and an append-only `audit_log`. These are in direct tension and the resolution is a schema
decision, not a policy one — it decides what columns exist.

**Recommendation.** Separate the bytes from the record. Erasure deletes the R2 object and nulls
extracted personal fields; the `document` row survives as a tombstone holding `sha256`, page
count, timestamps and who did what; `audit_log` retains events and hashes and never content. That
keeps the audit trail truthful ("a document was here, it was erased on this date, by this
request") while genuinely removing the personal data. Recorded as D-005.

### D-5 · The 10-year retention duty is the seller's, not the tool's `[medium]`

`02-` §9 sets "default 10 years for compliance evidence" as a retention setting. But GPSR places
that duty on the **economic operator**, not on their software vendor. If a customer cancels,
holding their technical files for ten years is storage cost, liability, and a GDPR problem, not a
service.

**Recommendation.** State it in the ToS and build it: on cancellation, a full export (the §8.1
technical-file package for every SKU) is generated and made available for 30 days, after which
everything is deleted. "We keep your file for ten years" is never offered. Recorded as D-006.

### D-6 · Native PDF input can remove the page-rendering step from v1 `[medium — scope saving]`

`02-` §6.1 renders every page to PNG before classification. The Claude API accepts PDFs directly
as base64 `document` blocks (32 MB / 600 pages per request; 100 pages on 200K-context models,
which includes Haiku 4.5), and the Files API lets one upload be referenced across requests
without re-sending it.

Rendering is still needed — but only for the **human-review UI**, which shows the page image
beside the extracted fields. That is a fraction of documents and it can be done lazily.

**Recommendation.** v1 extracts from the PDF directly and renders pages only for documents that
land in the review queue. This removes a pdfium/mupdf binding, a rendering job, and its storage
from the week-4 critical path, which is real relief given S-1. Keep `unpdf` for the cheap text-layer
check that decides whether OCR is needed at all. Recorded as D-007.

### D-7 · `confidence` and `sources[]` are stored but never surfaced `[medium]`

The requirement schema (§5.1) carries `confidence`, `sources[]`, `last_reviewed_at` and
`reviewer`. Nothing in either plan says the product *shows* them. `01-` §9 commits to "every rule
cites its source" — as a liability position, not as a UI requirement, and a liability position
that only exists in the ToS is not a defence.

It is also the answer to §4's "why not just use ChatGPT": a cited, dated, human-reviewed rule is
precisely what a chat answer cannot produce.

**Recommendation.** Every requirement rendered anywhere in the product — matrix cell, gap list,
scanner output, exported technical file — carries its citation, its `last_reviewed_at` date, and
its confidence where that is below `high`. A requirement with no primary source cannot be
published to the live catalog; make that a CI check on the catalog JSON, not a review habit.
Recorded as D-008.

### D-8 · The free scanner must never call a model `[medium]`

An unauthenticated public endpoint that accepts an uploaded file and calls a paid API is an
abuse surface with no rate limit that matters. It is also unnecessary: the scanner's whole job is
to run the deterministic evaluator over CSV rows, which costs nothing and is the honest
demonstration of the catalog.

**Recommendation.** Hard rule: no AI call from an unauthenticated path, enforced by a test, plus a
row cap on scanner uploads. Recorded as D-009.

### D-9 · Catalog version changes are a deploy step and a live read at the same time `[low]`

§5.1 compiles catalog JSON to the DB "on deploy" and re-evaluates nightly. A deploy that bumps
the catalog while a customer is reading their matrix gives them rows computed against two
different versions with nothing saying so.

**Recommendation.** `assessment.catalog_version` already exists in §4 — use it: the matrix shows
which version it was computed against, re-evaluation is an Inngest job rather than a deploy step,
and a version bump enqueues that job and writes the `catalog_change` record that drives the
customer digest. Recorded as D-010.

---

## C · Arithmetic and claims checked

**C-1 · The AI cost worked example reconciles.** §6.5: 12 pages × ~1,900 image tokens ≈ 23K, +3K
prompt = 26K × $2/MTok = $0.052; 1.5K output × $10/MTok = $0.015; total ≈ $0.07 ✓. Batch −50% →
$0.035 ✓. 300 documents → $10.50–21, matching the stated "$10–25 one-time" ✓.

**C-2 · Model IDs and prices verified today** against the current Anthropic reference, not from
memory: Haiku 4.5 `claude-haiku-4-5` $1 / $5; Sonnet 5 `claude-sonnet-5` $2 / $10; Opus 5
`claude-opus-5` $5 / $25; Batch API 50% ✓. All four match `02-` §6.5. Note for the `ai` package:
Haiku 4.5 has a **200K** context window where Sonnet 5 and Opus 5 have 1M, which is what caps
direct PDF input at 100 pages on the classification pass.

**C-3 · Two claims in §3 and §6.5 could not be verified and should not be relied on yet.**
(a) "cache reads 0.1× input" — the multiplier was not confirmed in this pass. (b) "Anthropic's
first-party API routes globally by default; a US-only `inference_geo` option exists at a 1.1x
price… EU-only inference is not a first-party option." The `inference_geo` parameter is real and
current; the price multiplier and the claim that no EU option exists were not confirmed. That
second one matters more than it looks: §9's entire data-minimisation posture ("minimise personal
data sent to AI providers") is justified by it. **Re-verify both before the privacy policy is
written**, because the privacy policy will make a factual assertion about where inference happens.

**C-4 · The churn figure depends on an unstated blended price.** `01-` §6: "at $4K MRR you need
6–10 new customers every month just to stand still," at 4–6% monthly churn. At the $50–75 blend
used earlier in the same section, $4K is 53–80 customers, 5% of which is 3–4 lost per month — so
6–10 would be growth of 3.5–9% a month, not standstill. The figure is right at a **$29-ish**
blend (138 customers, ~7 lost). Not an error so much as an unstated assumption, and it is
conservative in the safe direction — but the tier mix it implies (Starter-heavy) contradicts the
Growth-tier positioning everywhere else, which is worth resolving because it changes who the
onboarding call is for.

**C-5 · Structured-output API shape has moved since the plan was drafted.** Use
`output_config: {format: {...}}`, not the deprecated `output_format`; `strict: true` belongs on
the tool definition, not on `tool_choice`. One constraint worth knowing before designing the
review UI: API-native **citations are incompatible with `output_config.format`** and return a 400.
§15.2's `page_refs` approach (the model reports the page number as a schema field) sidesteps this
correctly — keep it, and do not later try to add native citations on top.

**C-6 · The name is undecided and week 1 creates a repository.** `01-` §9 lists four unverified
candidates. Playbook Lesson 5 is about exactly this: an unverified input that hardens because
every downstream document inherits it. Repo name, package namespaces, domain and email sender all
fork from it. Tracked as an open question with a date rather than allowed to settle by default.

---

## D · Where the plans are right and nothing should change

Worth stating explicitly, so that none of this gets "improved" later:

- **The strategic pivot away from storage.** §0's refusal to build the horizontal file manager is
  the most valuable paragraph in either document.
- **The catalog as the moat, not the AI.** §4's defensibility test holds up, and it is what makes
  the LLM genuinely swappable rather than nominally so.
- **Deterministic rules, AI reads only.** Principle 2. This is the correct architecture for a
  liability-bearing product and it should never be traded for a demo.
- **Merchant of record for VAT.** Correct, and unusually well-judged for a solo founder.
- **EU data residency by default.** Correct, and cheap if decided now rather than migrated later.
- **Agency fields (`is_agency`, `client`) in the v1 schema though the agency tier is v2.** Exactly
  the right hedge on `01-` §12's open question 1 — the data model does not have to wait for the
  ICP decision.
- **Verification as "signals, never verdicts" (§7).** The only defensible framing.
- **Not building a compliance chatbot (§6.7).** Right on liability and right on differentiation.

---

## E · Recommended deltas, in order

| # | Change | From | Source |
|---|---|---|---|
| 1 | Re-cut v1 into Slice A (weeks 1–6) and Slice B (weeks 7–14); push supplier portal, remaining schemas, MYC/Shopify exports and digests to v1.5 | `02-` §10.1 | S-1 |
| 2 | Move the free scanner to weeks 2–3 | week 10 | S-2 |
| 3 | Move privacy policy, customer DPA, first-tranche vendor DPAs and the deletion procedure ahead of the first real upload (week 6) | week 12 | S-3 |
| 4 | Spend weeks 1–4 on catalog and scanner only; defer auth and multi-tenancy past 5 October | concurrent | S-4 |
| 5 | One AI provider in week 4 behind the gateway seam; second adapter when the eval can score it | 3 providers | S-5 |
| 6 | Adopt the `unknown` ≠ `na` hard rule; unit-test every requirement for it | new | D-1 |
| 7 | RLS tests to week 1 and into the definition of done | week 12 | D-2 |
| 8 | Define the ≥90% accuracy target per field, on required fields, after normalisation | undefined | D-3 |
| 9 | Tombstone-on-erasure schema; audit log holds events and hashes only | unresolved | D-4 |
| 10 | Export-then-delete on cancellation; never offer 10-year custody | "default 10 years" | D-5 |
| 11 | Extract from PDF directly; render pages only for the review queue, lazily | render-all | D-6 |
| 12 | Surface citation, review date and confidence everywhere a requirement appears; CI-check that no published requirement lacks a primary source | stored only | D-7 |
| 13 | No AI call from an unauthenticated path; row cap on the scanner | unstated | D-8 |
| 14 | Catalog re-evaluation is a job, not a deploy step; matrix shows its catalog version | "on deploy" | D-9 |
| 15 | Re-verify the cache-read multiplier and the `inference_geo` claims before writing the privacy policy | §3, §6.5 | C-3 |
| 16 | State the blended price the churn target assumes, and reconcile it with the tier mix | §6 | C-4 |
| 17 | Decide the name by 30 September or accept a deliberate placeholder | undecided | C-6 |

Deltas 1–4 are the ones that matter this month. The rest can be absorbed as the work reaches them.
