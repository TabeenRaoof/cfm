# CFM — CLAUDE.md

**Read `tabeen_AGENTS.md` first.** It holds the project description, the standing rules, the workflow
before and during a story, the definition of done, and the repo map. Everything there applies to
Claude. This file only adds what is specific to working with Claude on this project.

---

## Claude-specific notes

**Plan before building.** For any story beyond a trivial change, use plan mode: explore the real
code, read the story and its dependencies, surface genuine design forks, get the plan agreed, then
implement. Do not go from a story title straight to code.

**Model choice.** Stronger reasoning model for planning, catalog authoring and review; a faster one
is fine once the plan is agreed and the work is mechanical. Claude cannot switch its own model —
say so at the transition point rather than continuing on the wrong one.

**Never state an Anthropic model name, model ID, price, context limit or API parameter from
memory.** Load the `claude-api` skill and read the current values, every time. This is not a
general-caution note — it is a product requirement. `packages/ai` routes on model names and
`docs/` quotes prices in the cost model, and both were already stale once between the technical
plan being written and this folder being created. Two specific claims inherited from the technical
plan are unverified and flagged in `project-setup/03-plan-review.md` §C-3: the cache-read
multiplier, and what `inference_geo` does and costs. Do not repeat either until they are checked.

**Anything that will be extracted, classified or prompted goes through `packages/ai`.** If a task
tempts you to `import Anthropic` in a route handler or a job, that is the wrong layer — there is a
test asserting it.

**Memory and this repository disagree sometimes.** If something recalled from a previous session
conflicts with `docs/decisions.md`, a story file, or `project-setup/03-plan-review.md`, the
repository wins. Say the conflict exists rather than silently picking one.

**Verify before asserting.** This project has a lot of numbers that look settled and are not:
requirement article references, registry names and fees, marketplace attribute keys, seller counts,
extraction accuracy, hours. Read the current file rather than recalling it. Where a figure comes
from a third party, quote it with its retrieval date.

**The two planning documents are read-only.** `01-business-report-...md` and
`02-technical-plan-...md` are never edited, not even to fix a typo or a number known to be wrong.
Corrections go to `project-setup/03-plan-review.md` or `docs/decisions.md`.

**Web research for the catalog needs a citation you can hand to a regulator.** When drafting a
requirement, cite EUR-Lex, the Commission's own guidance, the national registry, or the
marketplace's own help page — never a bureau's blog summarising them, and never a recollection.
Record the URL and the date you retrieved it in `packages/catalog/sources.md`.

**Be honest about what the catalog does not cover.** It is more useful to say "GPSR and packaging
EPR for six countries; WEEE and batteries are flagged but not encoded" than to imply breadth that
is not there. The same honesty applies in the product: an unencoded area shows as `unknown`, not
as absent.

---

## Quick reference

| Need | File |
|---|---|
| What we are building, and the rules | `tabeen_AGENTS.md` |
| The immutable strategy and architecture | `01-business-report-...md`, `02-technical-plan-...md` |
| Corrections to those two, and why | `project-setup/03-plan-review.md` |
| Why something is the way it is | `docs/decisions.md` |
| What a term means (GPSR, PPWR, RP, MYC, DoC…) | `docs/glossary.md` |
| What to work on | `stories/README.md`, then `stories/<ID>.md` |
| How to write a requirement | `docs/catalog-authoring.md` |
| Where a requirement's facts came from | `packages/catalog/sources.md` |
| Schedule, capacity, gates, cut list | `docs/sprint-plan.md` |
| What happened already | `docs/progress-log.md` |
| How to operate the thing | `docs/runbook.md` |
| Method, and what went wrong last time | `project-playbook.md` + `project-setup/playbook-addendum.md` |
