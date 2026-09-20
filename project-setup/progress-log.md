# Progress log

Chronological journal of what happened, newest last. Not a duplicate of `decisions.md` — this is
the "what happened and when," `decisions.md` is the "what was decided and why." A story or fix
usually shows up in both: here for the sequence of events, there for the reasoning worth
protecting from being silently reversed later.

Named in `tabeen_AGENTS.md`'s repo map as not yet existing until this entry created it
(2026-09-19 session, "review the work on this project" thread). Entries before that point are
backfilled from git history and the session transcript, as accurately as both allow; entries
from here on are written as the work happens, per `tabeen_AGENTS.md` line 277 ("append to the
progress log after any story completes").

---

## 2026-09-19 — Anthropic API integration goes live

The `@cfm/ai` gateway (provider abstraction, deterministic-first resolution, token-budget
enforcement) is wired to the real Anthropic API for the first time, using `claude-haiku-4-5` for
classification and `claude-sonnet-5` for extraction.

Two live, cost-gated smoke tests validate the whole seam end to end:

- **`classify_document`** — succeeded. Confirmed the schema-narrowing plumbing, provider
  adaptation, and cost tracking all work correctly. Cost: $0.000534.
- **`extract_document`** — succeeded, and earned its cost by finding a real gap: the
  deterministic date pattern in `@cfm/documents` didn't recognise "Signed on:" as an issue-date
  label, so `issue_date` — which pattern coverage says should resolve for free — escalated to the
  model unnecessarily on every RP-mandate document phrased that way. Fixed by adding
  `signed on`/`signed` plus French (`signé le`) and German (`unterzeichnet am`) equivalents,
  matching the multi-market pattern already used elsewhere. Verified the fix locally against the
  same text with zero further API cost, then added a regression test so the gap cannot silently
  return. Cost: $0.001205.

Both smoke scripts (`npm run smoke:anthropic -- --confirm`, `npm run smoke:anthropic:extract --
--confirm`) are kept in the repo as repeatable, deliberately-gated validation tools rather than
one-off throwaway code — dry-run first, three-layer spend guard, confirmation flag required.
Total spend: $0.001739, against a $1 test cap and each script's own $0.05 cap; neither limit came
close to firing.

Full suite at this point: 395/395 passing.

---

## 2026-09-19 (later) — Review, then version control and CI for the first time

A review of the plan docs, standing rules, the new `@cfm/supplier-request` package, and the gates
(typecheck, 432/432 tests, `npm run smoke`) surfaced one finding bigger than any code issue: the
project had never been under version control. No `.git` directory anywhere in the tree, despite
`.gitignore` and `.github/workflows/ci.yml` both existing — the CI workflow had never executed
once, and `tabeen_AGENTS.md`'s definition of done ("merged to `main` through a pull request") was
currently impossible to satisfy.

Alongside that, three code findings and a documentation-drift finding were raised for the next
session to fix (see below): the Anthropic cache-cost arithmetic, a state-machine hole in
`@cfm/supplier-request`, and stale numbers/claims across `README.md`, `.env.example` and
`tabeen_AGENTS.md`.

**Decided:** version control and CI first, then the review fixes, then the next feature
(`@cfm/evidence`) — see the sequencing question this session. Repo host: a private GitHub repo,
since `.github/workflows/ci.yml` already targets GitHub Actions.

**What happened, in commit order:**

- `d176f13` — `git init`; verified `.env.local` and `apps/scanner/dist` were already covered by
  `.gitignore`; first commit of the full working tree on `main`.
- Created the private GitHub repo (`TabeenRaoof/cfm`) with `gh`, pushed `main`.
- First-ever GitHub Actions run failed: `npm ci` requires a locked dependency tree, and
  `package-lock.json` had gone out of sync when `@cfm/supplier-request` was added without a
  matching `npm install`. Fixed locally, verified `npm ci` clean, committed (`4721dfb`), pushed —
  CI went green for the first time.
- `3227504` — Fixed the Anthropic cost-accounting bug: `costUsd` was computing
  `(inputTokens - cachedInputTokens)` at full price plus cache reads at the cached rate, which
  double-discounts cache reads, and never read `cache_creation_input_tokens` at all, so cache
  writes — the premium D-029 called "half the arithmetic" — were costed at zero. Invisible until
  now because nothing had set `cacheable: true`. Verified against current Anthropic docs rather
  than asserted from memory, then fixed by summing the three genuinely distinct input-token
  buckets (fresh, cached-read, cache-write) plus output, with a regression test. See D-037.
- `c856a03` — Fixed `@cfm/supplier-request`'s state-machine hole: `fulfilItem` could move a
  `draft` request to `partially_fulfilled`, after which `markSent` would throw forever because it
  requires `status === "draft"` — an unsendable request. Tightened `fulfilItem` to require the
  request to have been sent first, while still allowing fulfilment against an `expired` request
  (a late upload should still count). Fixed `isOverdue`'s string timestamp comparison to use
  `Date.parse()`. Added `requirementId` to `RequestedItem` — the field `@cfm/evidence` would need
  and that `EvidenceView.hasOpenRequest` had nothing to match against before this. Also: reminders
  now stop once the due date has passed, and email copy distinguishes a final reminder in both
  English and Chinese. See D-038.
- `0f197cc` — `Provider.estimateInputTokens` existed on the interface but the gateway's budget
  check never called it, estimating tokens some other way instead; wired it in and removed the
  now-dead `imageTokensPerPage` config field that nothing was actually using.
- `8263c82` — Corrected documentation drift accumulated across the last two sessions:
  `README.md`'s stale test count (378 → then-current) and missing `@cfm/supplier-request` row;
  `.env.example`'s claim that one script, not two, was permitted to spend real money;
  `tabeen_AGENTS.md`'s repo map, which no longer matched the actual directory structure; added
  `decisions.md` entries for the live Anthropic adapter (D-037) and the supplier-request package
  (D-038), following the precedent D-022/D-030/D-031 set of recording a package's design rules
  when it ships.

Full suite after this block: 441/441 passing, CI green on every push.

---

## 2026-09-19 (continued) — `@cfm/evidence`: the missing middle

Built the package that turns an accepted extraction into something the evaluator can actually
read — before this, `EvidenceView` and `NO_EVIDENCE` existed in `@cfm/catalog`, but nothing
implemented a real `EvidenceView`, so no upload could ever move an assessment off `missing`.

- `record.ts` — `evidenceFromVerdict` builds an `EvidenceRecord` from an accepted
  `ExtractionVerdict` only; throws on anything else rather than half-building one.
- `scope.ts` — `requirementMarketScope` reads a requirement's `applies_when` for
  `market.iso_country` leaves (through `all`/`any`/`not`) and returns the country set it's scoped
  to, or unscoped if none is named.
- `link.ts` — `linkEvidence` matches documents to requirements by type, then — for market-scoped
  requirements — requires the document's own `country` field to be in scope before linking.
  Refuses rather than guesses when a document doesn't state its market, and surfaces every
  refusal (`RefusedLink[]`) instead of dropping it silently. This is the concrete fix for the
  false-green case named in the review: DE and FR both require `epr_certificate`, and matching on
  type alone would let a German certificate satisfy the French row. `hasOpenRequest` is wired from
  open, non-terminal `SupplierRequest`s using the `requirementId` field added in the previous
  block's `@cfm/supplier-request` fix.
- 24 new tests, including the DE-cert-for-FR-row refusal in both directions, a no-stated-country
  refusal, and three end-to-end tests through the real `assessProduct` — missing → met via
  upload, the wrong-market cert staying `missing`, and pending → met via a fulfilled supplier
  request.

Regenerated `package-lock.json` for the new workspace package and verified `npm ci` from a clean
`node_modules` before committing — the exact mistake from the version-control block, not
repeated. Added D-039. Updated `README.md`'s package table and test count.

`daca078` — committed and pushed; watched the GitHub Actions run through to `success`.

**Full suite at this point: 465/465 passing.** All ten to-dos from the review plan (version
control, CI, Anthropic cost fix, supplier-request fixes and decisions, docs drift,
`estimateInputTokens` wiring, `@cfm/evidence` package and tests) are complete.

---

## 2026-09-20 — This progress log created

`docs/progress-log.md` (kept here at `project-setup/progress-log.md`, matching where
`decisions.md` actually lives rather than the playbook's literal `docs/` path) had been named in
`tabeen_AGENTS.md`'s repo map as not yet existing since the "repo map, corrected" pass above.
Created and backfilled from git history and the session transcript, going forward from here as
work happens rather than reconstructed after the fact.

## 2026-09-20 (continued) — First catalog review packet: 4 requirements researched against primary sources

Asked "how much more work to ship," which surfaced that all 27 catalog requirements were still
`state: "draft"` with every source `verified: false` — the largest gap between "the evaluator
works" and "the product tells anyone anything they can rely on," and D-008's rule is that only a
named human (Tabeen) publishes, so this can't be closed by an assistant alone.

What an assistant *can* do without overstepping that rule: the research. Picked the four
requirements Slice B's two target document types depend on —
`eu.gpsr.responsible-economic-operator` (`rp_mandate`), `de.epr.packaging-lucid`,
`fr.epr.packaging-citeo`, `uk.epr.packaging-registration` (all `epr_certificate`) — and fetched
each one's primary source directly (EUR-Lex, the German VerpackG statute text, GOV.UK plus the
actual UK statutory instrument, Légifrance for the French one, though that fetch was blocked by a
bot-check and came through a search result instead, flagged for a manual check).

Two were already correct as drafted (EU responsible-person Art. 16; German LUCID/dual-system
§§ 7/9). Two needed real corrections: the French row cited the general EPR principle
(`L541-10`) rather than the article that actually brings packaging into scope (`L541-10-1`), and
bundles a second legal basis (Triman marking, `L541-9-3`) under one citation; the UK row's
statutory instrument was unconfirmed and is now S.I. 2024/1332, which also revealed the
regulation splits "small producer" and "large producer" into materially different obligations
that this requirement's single evidence item doesn't yet distinguish.

Updated every source's `verified`/`retrieved_at`/note in the four requirement JSON files with what
was actually checked and how; corrected `article_ref` where the citation was wrong; left `state`,
`reviewer` and `last_reviewed_at` untouched on all four, since setting those is Tabeen's decision,
not something to infer. Wrote `project-setup/review-packet-2026-09-20.md` summarising the four
findings and the two open decisions (split the French row; how to scope the UK small/large
distinction) so review is reading and signing, not re-researching. Catalog gate and all 200
catalog tests still pass.

## 2026-09-20 (continued) — Tabeen's sign-off: the catalog's first 5 published requirements

Tabeen reviewed the packet in [PR #1](https://github.com/TabeenRaoof/cfm/pull/1), approved it with
notes, and made both open decisions: split `fr.epr.packaging-citeo` into two rows
(`fr.epr.packaging-citeo` for the EPR registration duty, new
`fr.epr.packaging-triman-marking` for the Triman-marking duty) rather than keep two legal bases
under one citation; and scope `uk.epr.packaging-registration` to registration only (Option A),
deferring the large-producer-only duties (PRNs/PERNs, compliance certificate, disposal fee) to a
future requirement rather than modelling them now.

Applying the sign-off caught two schema violations in the submitted JSON before they could land:
`state: "active"` isn't a value `RequirementState` accepts (`draft` or `published` only) —
corrected to `"published"`; `last_reviewed_at` needed a plain ISO date, not a full timestamp. Also
caught and fixed a citation bug the split introduced: the new Triman-marking row's Légifrance URL
had been copied from the EPR row and pointed at `L541-10-1`'s article page rather than
`L541-9-3`'s own page — the kind of thing that's easy to miss because both articles share a
Légifrance page family.

Updated `catalog.test.ts`'s "are all still drafts" assertion, correct until this commit and now
stale by design — it asserts the five published ids explicitly instead of an empty array, so
the test grows with each future review packet rather than needing deletion.

**Catalog gate: 5 published, 23 drafts, 0 issues — the first requirements in this catalog a
customer could actually be shown.** Full suite: 465/465. FR requirement count 11 → 12 (the
Triman split). Merged via [PR #1](https://github.com/TabeenRaoof/cfm/pull/1), squash-merged to
`main`, CI green post-merge.

## 2026-09-20 (continued) — Second catalog review packet: general-goods GPSR requirements

Picked the next 4 per D-034's own priority (general goods over category-specific depth):
`eu.gpsr.technical-documentation`, `eu.gpsr.manufacturer-identification`,
`uk.gpsr.general-safety-requirement`, `uk.gpsr.uk-responsible-person`.

Three were straightforward citation corrections once checked against the actual EUR-Lex/
legislation.gov.uk text: `eu.gpsr.technical-documentation` had cited "Art. 9(2), Annex," but
GPSR's only Annex is an old-Directive correlation table, not substantive content — corrected to
`Art. 9(2)-(3)`. `eu.gpsr.manufacturer-identification` cited the whole of Art. 9 for one specific
duty among seven the article covers — tightened to `9(6)`. `uk.gpsr.general-safety-requirement`
was already correct, just unverified.

The fourth, `uk.gpsr.uk-responsible-person`, turned into the batch's real finding. Its cited
regulation (GPSR 2005 reg. 8) is titled "Obligations of distributors," unrelated to appointing
anyone — but the deeper problem is the premise: as far as could be established, there is
currently **no blanket UK Responsible Person requirement for general consumer goods**. The
Product Regulation and Metrology Act 2025 only *enables* a future UKRP requirement by secondary
legislation not yet made; today's actual rule under GPSR 2005 is narrower and weaker — an
importer-of-last-resort inheriting some duties, not a duty to appoint anyone. A general UKRP duty
exists today only in specific sectors (cosmetics, medical devices confirmed), not for general
goods. Did not apply a citation fix — wrote up the finding and three options
(hold/rescope/split-by-sector) in `project-setup/review-packet-2026-09-20b.md` for Tabeen's
decision, since this is a scoping call, not something to sign off on as drafted.

Catalog gate and all 200 catalog tests still pass; nothing published yet from this batch.

## 2026-09-20 (continued) — Tabeen's sign-off on batch 2: 3 published, 1 held deliberately

Tabeen reviewed [PR #3](https://github.com/TabeenRaoof/cfm/pull/3) and approved three
(`eu.gpsr.technical-documentation`, `eu.gpsr.manufacturer-identification`,
`uk.gpsr.general-safety-requirement`), publishing them. For the fourth,
`uk.gpsr.uk-responsible-person`, chose option (a) from the packet explicitly: held, left as
`draft`, on the reasoning that forcing it now "risks modelling phantom compliance" until the
Product Regulation and Metrology Act 2025's secondary legislation actually creates the duty.
Recorded that decision directly in the requirement's own source note (not just this log) so a
future reader of the file, not only this log, sees it was a deliberate hold rather than an
oversight — `state` stays `draft` on purpose, not by default.

Updated `catalog.test.ts`'s published-ids assertion to the new set of 8. Catalog gate: 8
published, 20 drafts, 0 issues. Full suite: 465/465. Merged via
[PR #3](https://github.com/TabeenRaoof/cfm/pull/3).
