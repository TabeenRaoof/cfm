# project-setup/

Created 12 September 2026. Everything in this folder is new; nothing outside it was edited.

## What is here and why

Five files sit in the parent directory. Two are frozen, three were inherited from a different
project and needed adapting. This folder holds the adaptations and the review that produced them.

| File | Status |
|---|---|
| `../01-business-report-product-compliance-file-manager.md` | **Immutable.** Not edited. |
| `../02-technical-plan-product-compliance-file-manager.md` | **Immutable.** Not edited. |
| `../project-playbook.md` | Upstream, unedited. Still the method document. Overridden only where `playbook-addendum.md` says so. |
| `../tabeen_AGENTS.md` | **Rewritten for this project.** Instructions for every AI assistant. Carried over from an unrelated project and since purged of it entirely. |
| `../tabeen_CLAUDE.md` | **Rewritten for this project.** Claude-specific notes. Same history. |

| This folder | What it is |
|---|---|
| `03-plan-review.md` | Review of the business and technical plans. Findings, evidence, recommended deltas. Changes nothing by itself. |
| `playbook-addendum.md` | What changes in the playbook for a solo, commercial, regulated project. Adds lessons 27–33. Does not restate the upstream. |
| `decisions.md` | Seeded decisions log, D-001 to D-014, plus nine open questions. |

## Why the instruction files were rewritten rather than edited

`tabeen_AGENTS.md` and `tabeen_CLAUDE.md` arrived from an unrelated project — a different product,
a different domain, a three-person team, and an academic grading requirement. Roughly a third of
the original was domain content with no bearing on this product, and a second third assumed a team
that does not exist here. Both were rewritten from scratch against `01-` and `02-`; nothing of the
prior project remains in either, and nothing that contradicts this product's plans survives in them.

They keep their original filenames because that is where they already sit. On repository creation
they become `AGENTS.md` and `CLAUDE.md` at the root.

## What is proposed rather than settled

`03-plan-review.md` contains seventeen recommended deltas, and `decisions.md` records twelve of
them as `Proposed`. Only three things in this folder are settled: that the plans are immutable
(D-011), that the name is deferred (D-001), and this folder's existence.

`tabeen_AGENTS.md` is written as though the proposals hold, because an instruction file hedging
every rule is not an instruction file. If a proposal is rejected, it changes with it. The two
proposals most worth arguing with are **D-012** (re-cutting v1 into two slices) and **D-002** (the
hard rule), for opposite reasons: the first trades launch surface for a reachable date, and the
second is the one that should never be traded for anything.

## When this moves into a repository

These files do not stay here. On repository creation:

- `tabeen_AGENTS.md` → `AGENTS.md` at the repository root; `tabeen_CLAUDE.md` → `CLAUDE.md`.
- `decisions.md` → `docs/decisions.md`; `progress-log.md` → `docs/progress-log.md`.
- `03-plan-review.md` → `docs/plan-review.md`, alongside copies of `01-` and `02-` as
  `docs/archive/`.
- `project-playbook.md` and `playbook-addendum.md` → kept outside the repository, per the
  playbook's own instruction that it lives outside any one project.

The rest of the artefact list — tiered scope, capacity table, gate register, vendor register,
milestones, backlog, critical chain, repository setup, cut list — is in `playbook-addendum.md` §E,
and none of it exists yet.
