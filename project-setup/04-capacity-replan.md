# Capacity replan — 2–3 hrs/week

Written 13 September 2026, after Q-5 was answered. Supersedes the hour assumptions in
`03-plan-review.md` §S-1, which were computed against 5 hrs/week. `01-` and `02-` remain
immutable.

## The arithmetic

| | |
|---|---|
| Today → 12 December 2026 | ~12.8 weeks |
| At 2.5 hrs/week | **≈ 32 hours** |
| `03-plan-review.md` §S-1 assumed | 60–100 hours |
| `02-` §10.1 as written needs | 150–350 hours |

So the original plan is now **5–10× over**, not 3–5×. But that framing is the wrong one, and
fixing it is not mostly about cutting scope.

## The reframe that actually resolves it

**Two things changed the shape of the problem, and neither is visible in the hour total.**

**First, the engineering is no longer the constraint.** The catalog engine, the evaluator, the
importer, the scanner and its page, and the AI seam are built and tested. Most of what §10.1
scheduled for weeks 1–10 either exists or has been deliberately deferred to v1.5. Code is the
part that does not compete for Tabeen's hours.

**Second, 2–3 hrs/week is a 13-week constraint, not a permanent one.** `01-` §9 requires 20+
hrs/week from 12 December for the work to qualify as OPT employment. Capacity therefore goes up
roughly eightfold on a known date.

Which means the 32 hours before December should not be spent building. They should be spent
arriving at 12 December **with something to sell and people to sell it to** — because from that
date there is capacity to build, and there is no way to buy back three months of distribution.

## Where the 32 hours go

| Work | Hours | Why it is Tabeen's and not delegable |
|---|---|---|
| Review 4 requirement packets | ~2 | D-008: only a named human publishes. Packets now exist, so this is reading and signing, not researching |
| Choose an email platform; privacy notice for the waitlist | ~3 | A vendor decision and a legal document |
| Deploy the scanner and waitlist | ~2 | One-off; mostly account setup |
| **Combined distribution + discovery** (see below) | **~20** | Nobody else can be Tabeen in a seller forum |
| Gate-3 paperwork before charging | ~5 | DPAs, terms, billing account |
| **Total** | **~32** | |

Everything else is mine. That is the point of the split.

## The change that makes the numbers work

**Collapse Gate 1 and Gate 2 into one activity.**

`01-` §10 has them sequential: 15 interviews by 5 October, then a landing page and 150 scanner
uses by 15 November. At 2.5 hrs/week, interviews alone are 15 hours — half the entire budget
through December, inside three weeks that only contain 7.5. Gate 1 as specified is not
reachable, and `01-` §12.5 already anticipated exactly this: *"we stretch the gates by a month
rather than skip them."*

Stretching is right but insufficient on its own. The better move is that **one hour should serve
both gates**. `01-` §7.2 already describes the motion: answer a seller's question fully in the
forum, never pitch in-thread, keep the free tool in your profile. Under that motion:

- the answer is the distribution,
- the sellers who reply are the interviews,
- the scanner uses are the Gate-2 evidence, counted from host logs (D-021),
- and the questions asked are the catalog roadmap (`02-` §14.5 already proposes logging them).

That is not a fudge to hit a number. It is the same hour producing four outputs instead of one,
and it is only available because the scanner exists before the interviews rather than after.

## Revised gates

| Gate | Was | Now | Test |
|---|---|---|---|
| 1 · Problem | 15 interviews by 5 Oct | **8 seller conversations by 2 Nov**, from forum engagement | ≥5 rank getting/verifying supplier documents or per-market requirements top-3, and say ≥$29/mo |
| 2 · Demand | 150 scans **or** 100 waitlist by 15 Nov | **100 scans or 60 waitlist by 20 Dec** | Measured from host request logs and the email platform |
| 3 · Willingness | 8 paying by 31 Jan | **5 paying by 28 Feb** | Unchanged in kind; the bar moves with the timeline |

Kill conditions are unchanged. Lowering a bar because it is hard is how a gate stops meaning
anything — these move because the *timeline* moved, and the ratios behind them are the same.

**What this costs:** roughly six weeks of runway against `01-` §7.4's month-6 and month-12
targets. Those should be restated from the new baseline rather than quietly inherited —
playbook Lesson 5.

**What it does not cost:** the 12 December charging date, which is fixed by OPT and unaffected.
Charging opens with fewer customers than `01-` projected; that is the honest consequence of
2–3 hrs/week and it was always the more likely outcome.

## What I do between now and December

In priority order, none of it requiring Tabeen's hours beyond a decision:

1. Requirement drafts and review packets — one batch at a time, so review stays a 20-minute task
2. The catalog areas still flagged rather than encoded: WEEE, batteries, remaining EPR countries
3. v1.5 groundwork behind flags: supplier requests, the document pipeline, the technical-file PDF
4. Whatever the forum questions reveal is actually being asked

## The risk this plan carries

**Distribution is the single point of failure, and it is the part that cannot be delegated to
me.** Twenty hours of forum presence across thirteen weeks is roughly 1.5 hours a week, and
`01-` §6 is blunt that distribution has to be a machine rather than a launch. If those hours
do not happen, no amount of built product moves any gate — and that failure would look, from
the inside, like the product not being ready, which it is not.
