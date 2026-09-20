# CFM — instructions for AI assistants

Read this before doing any work on this project. It applies to every assistant used here, Claude
and ChatGPT alike. The point is that the behaviour is the same whichever tool is driving, and that
no tool quietly undoes a decision already made.

**"CFM" is a working label, not the product name.** The name is undecided — see `docs/decisions.md`
→ D-001. Do not invent one, and do not let a candidate name harden by using it in a file path, a
package namespace or a domain.

---

## What CFM is

A web application that tells a small physical-goods brand exactly what compliance evidence each
SKU needs for each market and sales channel, collects that evidence from their suppliers, keeps it
audit-ready, and re-checks the whole catalog when the rules change. Customers are UK and EU brands
with roughly 20–500 SKUs selling into the EU, plus the agencies and Responsible-Person bureaus who
manage them.

The two planning documents are `01-business-report-product-compliance-file-manager.md` and
`02-technical-plan-product-compliance-file-manager.md`. **They are immutable inputs.** Do not edit
them. Corrections and deltas live in `project-setup/03-plan-review.md`; decisions taken since live
in `docs/decisions.md`.

**What the product is not**, stated as plainly as the business report states it: it is not a
document store, it is not a Responsible Person (that role is legally EU-established and cannot be
sold from here), it is not a compliance consultancy, and it does not give legal advice. It is an
information and workflow tool. Every readiness verdict it produces is the customer's to confirm.

**Where the defensibility lives.** Not in the AI. In the versioned, cited, human-reviewed
requirement catalog, in the channel integrations, and in the workflow between them. Treat the
catalog as the most valuable thing in the repository and the model as a replaceable input, because
that is what they are.

---

## Standing rules — enforce in every session

### The hard rule

**A requirement whose applicability cannot be determined from the data actually known about a SKU
is never `na`. It is `unknown`, and `unknown` is never counted toward market-ready.**

An absent attribute is not a negative answer. If the catalog cannot tell whether a product is a
toy, contains a battery, or was manufactured outside the EU, the honest output is "we need to know
this," not a quietly disappeared requirement and a green cell. A false green is worse than a
missing feature: the customer ships, the listing is suppressed, and the one thing they paid for is
the thing that failed.

This governs the evaluator, the status semantics, the matrix colouring, the scanner output and the
exported technical file. Do not weaken it for a better-looking demo. Every requirement gets a unit
test that feeds it a product with the deciding attribute missing and asserts `unknown`.

### Tenant isolation is a property of every table

Customer documents are commercially confidential and contain third-party personal data. **A new
table is not done until a test proves organisation A cannot read organisation B's rows in it.**
Row-level security policies are written with the table, and the test is written with the policy —
not in a hardening week. A policy nobody tested is a policy nobody has.

The service-role key is used in background jobs only, never in a request path.

### Sourced or not published

**No requirement enters the live catalog without a citation to a primary source, a retrieval date,
a `last_reviewed_at` and a named reviewer.** Not a bureau's blog, not a summary article, not a
model's recollection — the regulation text, the official guidance, or the registry's own page. CI
rejects catalog JSON that lacks them.

And the citation is shown to the user, wherever the requirement appears: matrix, gap list, scanner
output, exported file. A source that exists only in the database is not a defence and not a
differentiator.

### Accuracy and liability honesty

This tool reports what evidence is present and what a versioned catalog says is required. It does
not certify anything, and it is not legal advice.

**Never write or imply that the product guarantees compliance, verifies a document, or approves a
listing.** The verification module produces *signals*, never verdicts — "review recommended,"
never "authentic." Every readiness score carries its disclaimer. If a phrasing would sound like a
guarantee to a customer about to ship 500 units, rewrite it.

### No promised numbers

Extraction accuracy, requirement coverage, time saved, hours, cost per document, conversion rates:
all are estimates until measured. **Do not invent a measured value and do not restate a planning
estimate as a result.** If a number is needed and does not exist, say so and name the thing that
would produce it.

This applies with particular force to **AI model names, prices, context limits and API shapes** —
verify them against current documentation every time rather than recalling them. They change
monthly, and two claims in the technical plan are already flagged as unverified in
`project-setup/03-plan-review.md` §C-3.

### The AI never decides what the law requires

The LLM classifies documents and extracts fields. It does not decide applicability, does not write
a requirement, and does not set a status. Applicability is computed by the deterministic evaluator
from the catalog.

A corollary with teeth: **no AI call from an unauthenticated code path.** The free scanner runs the
evaluator and nothing else.

### Do not relitigate settled decisions

`docs/decisions.md` records what has been decided and why, D-001 onwards. Do not reopen or quietly
reverse one. If you believe a decision needs revisiting, say so explicitly and stop there — do not
build past it in either direction.

---

## Before starting any story

1. **Read the story file in full**, in `stories/` — the index is `stories/README.md`. Then read
   the stories it depends on, and any story that depends on it.
2. **Check `docs/decisions.md`** for anything that governs this area.
3. **Check `project-setup/03-plan-review.md`** if the story touches sequencing, the catalog, the
   AI pipeline, privacy or retention. It carries corrections to the technical plan that the
   technical plan itself does not contain.
4. **Check for conflicts** with work in flight and with existing code touching the same modules,
   tables or endpoints.
5. **Plan before building** for anything non-trivial. Explore the real code first, surface genuine
   design forks, agree the approach, then implement.

If the acceptance criteria are ambiguous, resolve that first. An ambiguous story is not Ready,
whatever the index says.

---

## While building

- **Tests alongside the code — during implementation, not after the story is "done."** Not written
  first as a batch, not bolted on afterwards as a batch, and never deferred to a follow-up story:
  add the test for each piece of logic as that logic is written. **This is a joint obligation of
  the engineer and the assistant: the assistant does not get to skip it because the turn did not
  ask for it, and the engineer does not get to skip it because the assistant did not offer.** Tests
  written after the fact are written to pass — they document the path you built, not the paths you
  missed — and "tests in a follow-up" is the first thing cut when a date tightens. The narrow
  exception is behaviour that genuinely cannot be economically automated (a live vendor webhook, a
  real card charge); that takes a written manual check, with the story stating *why*. "It was
  quicker" is not a reason.

  Three areas where a missing test costs a customer rather than an afternoon: **the catalog
  evaluator**, **RLS policies**, and **channel mappers**. Nothing in those three merges untested.

- **Verbose inline comments that explain *why*, not what.** In the catalog especially: a
  requirement's `applies_when` clause should carry the reasoning and the article reference, because
  the person re-reading it in eight months is reconstructing a legal argument, not a code path.
- **Progressive logic.** Build up incrementally before abstracting. An explicit loop beats a clever
  chain wherever clarity matters more than brevity.
- **No silent failures.** An explicit error always beats a swallowed exception or a defaulted
  value. In a compliance tool a quiet wrong answer is worse than a loud refusal — this is the hard
  rule in a different costume.
- **Meaningful names.** `assessment_status`, `catalog_version`, `evidence_valid_to`,
  `required_evidence` — not `status`, `ver`, `data`.
- **One story is one pull request.** If the change is growing past one or two work sessions, stop
  and split it.
- **Strict TypeScript everywhere.** No `any` in the catalog, the evaluator, the extraction schemas
  or the channel mappers. Zod schemas are the single source of truth for extraction shapes.
- **Provider SDKs are imported in `packages/ai` and nowhere else.** A test asserts this. Model and
  provider names are configuration, never literals in feature code.

### Never commit

- **Customer or design-partner documents.** Ever, under any circumstance, in any form — not as a
  test fixture, not redacted, not "just this one." The golden set lives outside git behind a
  download script; commit the script and the checksums.
- **Any key, token, credential or connection string.** Vendor keys, AI provider keys, Supabase
  service-role keys, channel credentials. Environment variables and the secret store only.
- **Anything covered by the Xylo intern agreement.** No Xylo code, no Xylo methodology documents,
  no internal formats carried across. Read the IP-assignment and confidentiality clauses before
  writing code, not after.
- **Real seller data in a fixture**, including scraped ASINs and listing dumps tied to a
  identifiable business.

---

## Definition of done

Every story, without exception:

- Merged to `main` through a pull request, never pushed directly.
- **Self-review as a reviewer, not as the author.** This project has one engineer, so the second
  pair of eyes does not exist — and pretending otherwise is how the gap gets missed. The substitute
  is mechanical: read the full diff in the pull request view (not the editor) before merging, with
  the story's acceptance criteria open beside it, and write the review comment you would have
  written for someone else. Where a reviewer would have caught something, a test has to.
- CI green: lint, typecheck, unit tests, RLS tests, catalog validation, and the extraction eval
  where the story touched a prompt or a schema.
- **Unit tests for this story's logic, written while the logic was written and passing in the same
  pull request** — or, only where automation was genuinely impossible, a written manual check with
  the reason stated.
- Runs from a clean checkout with only `.env.example` filled in.
- **Completion recorded on the story file**: the date, the pull request, and actual hours against
  the estimate.
- **The moment a pull request merges, `State: Done` is set on the story file and the matching row
  in `stories/README.md` is updated in the same action.** Not a follow-up. A story left `In review`
  after merging is what makes the index untrustworthy, and an untrustworthy index is what leads to
  working a story that is already done or still blocked.

Acceptance criteria are per story. The definition of done is not — it is the same every time.

---

## Repo map

```
README.md                 — repository front door
AGENTS.md                 — this file; instructions for every AI assistant
CLAUDE.md                 — Claude-specific notes; points here for everything else
                            (pre-repo, these two live as tabeen_AGENTS.md / tabeen_CLAUDE.md)

docs/
  decisions.md              — settled decisions, D-001 onwards; do not relitigate
  glossary.md               — GPSR, PPWR, EPR, RP, AR, MYC, DoC, technical file, assessment…
  sprint-plan.md            — schedule, capacity, gates, cut list
  progress-log.md           — running chronological journal, newest at the bottom
  story-template.md         — template for a new story file
  catalog-authoring.md      — how to research, write and review a requirement
  runbook.md                — daily/weekly/monthly operations, incident basics
  opt-relevance.md          — how this work relates to the CS degree; keep current
  incidents/                — post-mortems
  archive/                  — superseded drafts, kept for their reasoning

stories/                  — one file per story; README.md is the index

apps/web                  — Next.js app (UI, route handlers, server actions)
packages/catalog          — requirement JSON, evaluator, tests, sources.md
packages/ai               — gateway, provider adapters, versioned prompts, eval harness
packages/documents        — ingest, classify, extract, validators, Zod schemas
packages/channels         — amazon/, shopify/, bol/ — mappers, templates, fixtures
packages/db               — Drizzle schema, migrations, RLS policies and their tests, seed
packages/emails           — React Email templates
jobs/                     — Inngest functions
golden-set/               — download script and checksums only; never the documents
```

**These are places, not people.** The layout separates the algorithm from the service that exposes
it on purpose: `packages/catalog` must run from a script or a test without booting Next.js, and
`packages/ai` must be swappable without touching anything that imports it.

---

## Working with an intern

An intern drafts catalog research, curates the golden set, maintains the standards table, writes
content, and runs the Friday QA pass. That work is genuinely valuable and it is also the input to
the product's moat, so:

- **Every catalog entry an intern drafts is reviewed and signed off by Tabeen before it is
  published.** The `reviewer` field records who, not who drafted it.
- **Never give an intern production access, customer documents, or AI provider keys.** Not
  temporarily, not to unblock something.
- Golden-set documents must be public samples or carry written permission from the design partner.

---

## Recording as you go

- **Record decisions as they are made.** If a conversation settles something that governs later
  work, add it to `docs/decisions.md` with a number and the reasoning. A decision without its
  reasoning gets reversed by whoever forgets it — including an assistant in a fresh session.
- **Append to the progress log** after any story completes, any catalog version publishes, any
  design-partner session, and any gate result. Newest at the bottom, never delete an old entry.
- **Superseded instructions are marked, not deleted.** Note what replaced them and why.
- **Keep `docs/opt-relevance.md` current.** It is immigration evidence, and it is written by
  accumulating, not by reconstructing in January.

---

## Things to refuse or flag rather than do

- Weakening the hard rule — returning `na` where the data does not support a determination, or
  counting `unknown` toward market-ready.
- Adding a table, policy or migration without its isolation test.
- Publishing a requirement with no primary source, no retrieval date, or no reviewer.
- Writing copy, a UI string or a document that states or implies the product guarantees
  compliance, verifies a document, or constitutes legal advice.
- Letting the model decide what a regulation requires, or moving applicability logic out of the
  catalog to "make it smarter."
- Calling an AI provider from an unauthenticated path.
- Stating a model name, price, context limit or API parameter from memory rather than from current
  documentation.
- Committing customer documents, fixtures, secrets, or anything covered by the Xylo agreement.
- Opening a pull request whose code has no tests, or agreeing to add tests in a follow-up.
- Reversing a decision in `docs/decisions.md` without it being reopened explicitly.
- Building past a gate whose result is not in yet, when the work would be sunk by a kill.
- Expanding scope beyond the current slice because it "would be easy to add" — read
  `project-setup/03-plan-review.md` §S-1 before agreeing that anything is easy to add.
- Editing `01-business-report-...md` or `02-technical-plan-...md`. They are immutable.
