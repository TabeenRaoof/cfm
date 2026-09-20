# Project Playbook — CFM Addendum

**This is an addendum, not a copy.** `project-playbook.md` remains the upstream document and was
not edited. Everything it says still applies except where a section below overrides it explicitly.

Deliberately no duplication: the upstream document's own Lesson 20 is that two places storing the
same fact will drift, and a forked 573-line playbook is that lesson happening to the lesson. If a
practice is unchanged, it is not restated here.

Written 12 September 2026, for a commercial, solo, regulated-domain project — three conditions the
upstream playbook was not written under, since it came out of a three-person graded coursework
project. Treat everything it marks as project-specific as an example from that project, not as
guidance for this one.

---

## New transferability markers

Extending the upstream table in §0:

| Marker | Meaning |
|---|---|
| `[Solo]` | One person. Every practice that assumes a second human is either removed or mechanised. |
| `[Commercial]` | Real customers and real money. The assessor is the market, and it does not give partial credit. |
| `[Regulated]` | The software makes assertions someone acts on, in a domain with a legal standard. Wrong answers have consequences outside the repository. |

`[Graded]` is inert on this project. `[Small team]` is inert until someone else joins.

---

## A · What changes when the team is one person `[Solo]`

### Branch protection — the settings that actually work alone

Upstream §5 lists eight settings and Lesson 8 warns that "do not allow bypassing" plus "require one
approving review" blocks every merge when there is one collaborator. That warning is a note there.
Here it is the configuration, so state the working set outright:

**Enable:** require a pull request before merging · require status checks to pass · require the
branch to be up to date · block force pushes and branch deletion · require conversation resolution.

**Do not enable:** require an approving review. **Do not enable** "do not allow bypassing" until a
second person exists.

The pull request is still required, because the diff view is the review surface even with nobody
else in it. What replaces the approver is CI — which is why the status-check list has to be real.

### Review does not disappear; the reviewer does

Losing the second pair of eyes is a genuine loss and the honest response is to name what it caught
and replace it mechanically, not to declare that self-review is equivalent. Three substitutes, in
descending order of how much they actually recover:

1. **Anything a reviewer would have caught becomes a test.** This is most of the value, and it is
   the only substitute that works while tired.
2. **Read the diff in the pull request view, not the editor, with the acceptance criteria open
   beside it, and write the review comment you would have written for someone else.** The change of
   surface is doing real work: the editor shows you the code you meant to write, the diff shows you
   the code you wrote.
3. **Use the assistant as the adversarial reader, explicitly.** "Review this as a reviewer who
   thinks it is wrong" gets different output from "does this look right." Neither is a substitute
   for 1.

Cap work in progress at **one**. Upstream says two per person; two in flight with one person is
just one story with extra context-switching.

### Capacity is not a table, it is a ceiling shared with everything else

Upstream §2 computes per-person hours against a per-person ceiling. Solo, that computation is
trivially the team total — which is exactly what makes it easy to skip, and skipping it is what
produced the 3–5× overcommitment documented in `03-plan-review.md` §S-1.

Two additions:

- **Count the competitors for the same hours**, by name: courses, an existing job, a job search,
  the interviews the validation plan requires. A "5 hrs/week" figure that has not had those
  subtracted is a wish.
- **Solo makes the serial chain (upstream Lesson 4) total.** With three people some links run in
  parallel by luck. With one, every link is serial, so the critical chain *is* the plan and the
  hour total is only a sanity check on it.

### What survives from §3, and what does not

Claiming, lane ownership and the dependency register are moot alone. Two artefacts survive with
their purpose changed, and they are worth more here than upstream, not less:

- **The frozen contract** decouples present-you from future-you rather than two people. The
  interface written down in September is what stops January from rewriting the September module to
  understand it.
- **The synthetic generator** is still the highest-leverage artefact and now serves a different
  master: it removes the wait for *external* dependencies you cannot schedule — a vendor approval,
  a design partner who has not sent their catalog, a marketplace API you have not been granted.

---

## B · What changes when the assessor is the market `[Commercial]`

### Two kinds of gate, and only one of them is in the upstream playbook

Upstream §2 has milestones with falsifiable gates, and every gate names a **fallback**: "a phone
completes a session end to end, or we present the batch-only variant." That shape assumes the
project continues either way, because coursework does.

Commercially there is a second kind, and conflating them is expensive: a **kill gate**, where the
named consequence is *stop*. The business plan's three gates are of this kind and say so.

Three things follow, and none of them are in the upstream text:

- **Write the kill condition before the pass condition,** and make it as concrete. A kill condition
  written after a pass condition is written to be unreachable.
- **A gate measures evidence, and evidence has a lead time.** See Lesson 27.
- **Anything built before a kill gate should be an asset that survives the kill.** See Lesson 29.

### Cost per customer is a first-class number from the first line of code

`[Commercial]` projects have a number that graded ones do not: what it costs to serve one customer
for one month. It is cheap to instrument on day one (log model, tokens and cost per call against
the organisation; put a spend-per-organisation view in `/admin`) and effectively impossible to
reconstruct later from vendor invoices.

The pricing page is a bet on this number. Do not ship a plan tier before the instrumentation that
tells you whether the tier is profitable.

### Distribution is a build item with a lead time, not a launch

A funnel target dated November is produced by a machine that has to exist in September. Put the
things that generate distribution — the free tool, the content pipeline, the partner conversations
— in the same backlog as the features, with the same estimates and the same dates. They compete
for the same hours, and treating them as "marketing, later" is what makes them arrive after the
gate that needed them. This is Lesson 27 in its commercial form.

### Vendors are a dependency chain with legal steps in it

A `[Commercial]` project accumulates vendors, and each one carries a contract step — a data
processing agreement, an approval, a review queue — that takes calendar time and cannot be
compressed by working harder. Marketplace API approvals take weeks; DPAs take an afternoon but
only if someone has an afternoon.

**Write a vendor register with a "needed by" date derived from the event that triggers the need**,
not from launch. See Lesson 28 for the trigger that is most often got wrong.

---

## C · What changes when the software asserts things `[Regulated]`

### Every project in this class has one invariant; find it and write it first

Upstream §8 files its own example of this under project-specific content while marking the
*practice* as transferable. The practice is worth more than a footnote. In any system whose output
someone acts on, there is one sentence that, if violated, makes the product worse than not having
it — and it is almost always about what the system does when it does not know.

For CFM: a requirement whose applicability cannot be determined is `unknown`, never `na`. A
measurement tool's version of the same sentence is that an unmeasured dimension cannot be reported
as within tolerance. The shape is identical, and so is the generalisation — see Lesson 30.

Test for whether you have found yours: *what does the system output when it does not know, and
does that output look identical to "fine"?* If it does, you have found the bug that ends the
product.

### Sourced or not published

Every assertion the product makes traces to a primary source, with a retrieval date and a named
human reviewer, and the citation is shown to the user rather than stored. Enforce it in CI on the
data files, not in a review habit — a rule that lives only in prose gets traded away (upstream
Lesson 19), and this one gets traded away at exactly the moment a competitor ships breadth.

### Signals, never verdicts, for anything heuristic

Where the system uses a heuristic (a document-authenticity check, an anomaly score, a match
confidence), its output is a *signal that recommends review*, never a conclusion. The moment a
heuristic's output is phrased as a verdict, its false positives and false negatives become your
liability rather than the user's judgement.

### Two invariants, not one, when the data is other people's

`[Regulated]` usually implies `[Multi-tenant]` in practice: the assertions are about customers'
confidential things. Tenant isolation is then a second invariant of the same rank as the first, and
it is tested per table rather than reviewed per release.

---

## D · Additional lessons `[27–33]`

Continuing the upstream numbering, which is never renumbered. These came out of reviewing the CFM
business and technical plans on 12 September 2026 — before implementation, which is unusual: they
are failures caught on paper rather than in flight, and they are recorded here on the grounds that
a cheap lesson is still a lesson.

**27. A gate's evidence has a lead time; schedule the producer, not the deadline. `[Commercial]`**
A validation gate required 150 uses of a free tool by 15 November, and the tool was scheduled to
ship in the week of 10 November. Nothing about either date was wrong on its own. *For every gate,
find the artefact that produces its evidence, work backwards by how long the evidence takes to
accumulate, and schedule the artefact there — a gate whose evidence has a four-week lead time is
really a deadline four weeks earlier.*

**28. Legal and privacy obligations are triggered by the first real data, not the first invoice. `[Commercial]`**
A plan correctly listed DPAs, a privacy policy and a deletion workflow as prerequisites — for
charging, on 12 December — while scheduling real customer documents to arrive in week 6, six weeks
earlier. *Ask what event actually triggers each obligation. For data-protection duties it is the
first byte of someone else's data, which on most projects arrives long before revenue and is never
the date on the compliance checklist.*

**29. Work done before a kill gate should be an asset that survives the kill. `[Commercial]`**
Four weeks of build ran concurrently with a validation gate whose failure condition was real, and
nothing said which of that work would still be worth having afterwards. Sorting it took ten
minutes: the rule catalog and the free tool were portable to a consulting offer or a different
product; the auth and billing scaffolding was pure sunk cost. *Before a kill gate, sort the planned
work by whether it survives a "no", and spend the pre-gate hours on the surviving column. It costs
nothing if the gate passes.*

**30. A missing input is not a negative answer. `[Regulated]`**
A rules engine evaluated conditions like "manufacturer is outside the EU" against imported data
where the column was frequently absent, and nothing specified what an unresolvable condition
returned. The plausible-looking default — treat it as not applicable — silently deletes the
requirement and renders the item green. *Any engine evaluating rules over user-supplied data needs
a third outcome beside true and false, and that outcome must be visible in the output and must
never be counted as success. Decide it before the first rule is written; retrofitting it means
re-auditing every rule.*

**31. A seam satisfies a portability principle; N implementations satisfy nothing yet. `[Universal]`**
A principle that "no feature may depend on one vendor" was translated into wiring three vendors in
week four — before one path worked end to end and before an eval existed to compare them. *What
the principle actually requires is the interface plus a test that nothing outside it imports a
vendor. Build the seam immediately and the second implementation at the moment you can measure the
swap; until then N implementations cost N times the maintenance and prove nothing.*

**32. Working alone removes the reviewer, not the review — say which gate you deleted. `[Solo]`**
A definition of done inherited from a three-person project required approval by another team
member, which on a solo project is either a lie or a deleted safety net. *Name what the second
reader was catching, and replace it deliberately: most of it becomes tests, the rest becomes a
changed reading surface. A definition of done that quietly drops a step is worse than one that
records the step as consciously removed, because the second one can be restored when someone
joins.*

**33. Verify the vendor facts your legal position rests on. `[Commercial]` `[Regulated]`**
A privacy design justified sending minimal personal data to a processor with a factual claim about
where that processor could run inference, carried forward from an undated source. *A claim about a
vendor's behaviour that ends up inside a privacy policy or a customer contract is a load-bearing
fact, not background. Verify it against current documentation, record the date you checked, and
re-check it whenever the policy is revised — vendor terms change faster than policies do.*

---

## E · Artefacts to produce, adjusted `[Solo]` `[Commercial]`

Upstream §9 lists eleven artefacts in dependency order. That order holds. Four changes:

- **Item 1 (answers to Part 1) is largely already done**, in `01-` and `02-`. What is missing is
  the honest hours answer — see §A above.
- **Insert, between items 4 and 5: a gate register.** One row per gate: pass condition, kill
  condition, the artefact that produces the evidence, the date that artefact must exist by
  (Lesson 27), and which planned work survives a kill (Lesson 29).
- **Insert, after item 5: a vendor register.** One row per vendor: what it processes, which
  contract step it needs, and the *event* that triggers the need (Lesson 28).
- **Item 10's "test that the gate works" is more important here, not less.** With no approver, CI
  is the gate. Attempt a direct push and a merge with a failing check; both should be refused, and
  the refusal is the evidence.

---

## Changelog

- **2026-09-12** — created, alongside `AGENTS.md` and `CLAUDE.md` for CFM, from a review of the
  business and technical plans. Adds the `[Solo]`, `[Commercial]` and `[Regulated]` markers, the
  solo branch-protection set and review substitutes, kill gates as distinct from fallback gates,
  and lessons 27–33. Overrides upstream only where stated; everything else in `project-playbook.md`
  stands unchanged.
