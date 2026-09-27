# CFM

Working label only — the product name is undecided. See `project-setup/decisions.md` D-001.

Compliance evidence management for small physical-goods brands selling into the EU and UK.
Strategy and architecture live in `01-business-report-…md` and `02-technical-plan-…md`, which
are immutable; corrections to them are in `project-setup/03-plan-review.md`.

## Start here

| | |
|---|---|
| Rules for every AI assistant, and the definition of done | `tabeen_AGENTS.md` |
| Claude-specific notes | `tabeen_CLAUDE.md` |
| Decisions and open questions | `project-setup/decisions.md` |
| Review of the two plans | `project-setup/03-plan-review.md` |
| Privacy policy, DPA, design-partner agreement, deletion procedure (drafts) | `legal/README.md` |

## Running it

```bash
npm install
npm test               # 639 tests, including row-level security against the real migrations
npm run typecheck
npm run catalog:check  # the requirement publish gate
npm run smoke          # runs the deterministic path on a bare Node, no build step
npm run scanner:preview # build the public scanner, drafts included
```

Two more scripts spend real money against the live Anthropic API and are never run by CI or by
the commands above — see `.env.example` and each script's own header before running either:
`npm run smoke:anthropic -- --confirm` and `npm run smoke:anthropic:extract -- --confirm`.

## The rule everything else follows from

A requirement whose applicability cannot be determined from what is actually known about a SKU
is never "not applicable". It is `unknown`, and `unknown` never counts toward market-ready.

It runs from the CSV cell (`@cfm/import`'s blank-is-not-false boundary) through three-valued
logic (`@cfm/catalog`) to the scanner's output, and it is tested end to end at each step.
See `tabeen_AGENTS.md` and `packages/catalog/README.md`.

## Packages

| Package | What it is | Calls a model? |
|---|---|---|
| `@cfm/catalog` | Requirement catalog and the deterministic evaluator | **Never** |
| `@cfm/import` | CSV to facts. Where "we were not told" stays distinct from "no" | **Never** |
| `@cfm/scanner` | The free public scanner: spreadsheet in, gap list out. Its `assessProducts` also drives readiness in `apps/web` | **Never** |
| `@cfm/techfile` | The per-SKU technical file a seller would hand to an authority | **Never** |
| `@cfm/channels` | Channel exports — template-driven, plus a neutral export that cannot be wrong | **Never** |
| `@cfm/documents` | Extraction schemas, deterministic patterns, validators, the confidence gate | **Never** |
| `@cfm/ai` | The provider seam — the only place that may | Only when code cannot answer |
| `@cfm/supplier-request` | The supplier magic-link request lifecycle, reminder scheduling, EN/ZH email templates | **Never** |
| `@cfm/evidence` | Links an accepted extraction to the catalog requirement(s) it satisfies, market-scoped | **Never** |
| `@cfm/waitlist` | Waitlist signup validation, the storage seam, unsubscribe tokens | **Never** |
| `apps/scanner` | The live public scanner (cfm-scanner.pages.dev): static page, waitlist, privacy notice, Cloudflare Functions + D1 | **Never** |
| `apps/web` | The logged-in product (Slice B, D-048–D-051): organisations, members, CSV import, documents and evidence, readiness per product × market, technical files. React SPA + one Cloudflare Worker (API, document queue), Supabase Postgres/Auth/RLS | Only to read documents, through `@cfm/ai`, after the deterministic pass |
