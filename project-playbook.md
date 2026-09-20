# Project Playbook

A reusable method for planning and running a software project with a small team and AI
assistants. Written from what worked, and what went wrong, building ProofShape (CS595 capstone,
Fall 2026). Kept deliberately outside any repository.

**Status:** living document. Update it as the project teaches you something new. Last
updated 2026-09-06.

---

## 0 · How to use this

### If you are a person starting a new project

Copy this file into the new repository, read Part 1, and answer those questions with your team
before letting anyone write a plan. Most planning failures are answered questions that were
never asked.

### If you are an AI assistant and someone pointed you here

Do not start writing a plan. Work in this order:

1. **Read Part 1 and ask the questions you cannot answer from the repository.** Ask them
   together, in one pass, rather than one at a time.
2. **Produce the artefacts in Part 9** in that order. Each depends on the one before it.
3. **Apply the transferability markers.** Anything marked `[ProofShape]` is an example, not an
   instruction — adapt or drop it.
4. **Do the arithmetic and show it.** Every hour total, percentage and date in a plan must
   reconcile. Verify by computing, never by recalling. See Lesson 1 and Lesson 4.
5. **Surface conflicts rather than smoothing them.** If the team's request contradicts the
   structure already agreed, say so once, clearly, then do what they decided.

### Transferability markers

| Marker | Meaning |
|---|---|
| `[Universal]` | Applies to essentially any software project. |
| `[Small team]` | Assumes 2–5 people who all know each other. Breaks down above that. |
| `[Part-time]` | Assumes people working a few hours a week, not full time. |
| `[Graded]` | Specific to coursework or anything with an external assessor. |
| `[ProofShape]` | Specific to this project. Example only. |

---

## 1 · Questions to answer before planning `[Universal]`

Nothing below can be answered by an assistant from the code. Get answers first.

**Scope**
- What is the minimum thing that must work for this to have been worth doing?
- What would be good to have, and what is genuinely optional?
- What are we explicitly *not* doing? Write it down; it is the most useful list you will make.

**People and time**
- How many hours per week does each person *actually* have, not aspirationally?
- How many working weeks, minus holidays and known collisions?
- What is each person's real skill overlap? Can anyone pick up anything, or not?

**Hard constraints**
- What external requirements exist that cannot be negotiated? Grading criteria, a demo date,
  a compliance rule, a customer commitment.
- Which of them are measured, and *how* are they measured? A requirement stated as a
  percentage needs a denominator before it can be planned against. `[Graded]`

**Uncertainty**
- What is the single riskiest technical assumption?
- What would prove or disprove it fastest, and can that be done in week one?

**Tooling**
- What platform, and what does it cost? Check plan-gated features before designing around
  them. See Lesson 7.
- What hardware exists already? Measure it before assuming it is inadequate. See Lesson 10.

---

## 2 · Structuring the plan `[Universal]`

### Tiers, not a flat backlog

Split the deliverable into three tiers: **must work**, **should work**, **could work**. Tier 1 is
the thing that makes the project worth having existed. It is never cut, and everything else is
explicitly cuttable.

This single move does more than any other to prevent a half-finished everything at the end.

### Give every work category a home before writing stories `[Universal]`

Story prefixes and directories must cover each other. On ProofShape thirteen stories prefixed for
generative-AI work had no directory to live in, because the layout was written from the system
diagram and the prefixes were written later from the work. They would have scattered prompts and
API-key handling across three modules before anyone noticed.

**Check the mapping explicitly:** list the prefixes, list the directories, and confirm each prefix
has exactly one home. Do it when the backlog is first written, not after someone starts.

Two layout choices worth making deliberately rather than by accident:

- **Separate the algorithm from the service that exposes it.** Keeping them apart means the
  algorithm runs from a script or a test without starting a server, and the service is testable
  without the algorithm's hardware.
- **A shared-types module that imports nothing local.** Without one you get duplicated definitions
  that drift, or an import cycle the first time two modules need the same object. The "imports
  nothing local" rule is what keeps it from becoming a junk drawer.

### Lanes are places, not people

Define work areas as **directories**, not as person assignments. `recon/`, `capture/`,
`inspect/` rather than "Alice's part". Then ownership can float without renaming anything, and
you can switch between "everyone owns an area" and "everyone works everywhere" without
rewriting the plan.

**Do not number both tiers and lanes 1–3.** See Lesson 6.

### Milestones with falsifiable gates

Every milestone states *what demonstrably works by that date* and *what happens if it does not*.
"Reconstruction integrated" is not a milestone. "A phone completes a session end to end, or we
present the batch-only variant" is.

### Capacity is per person `[Part-time]`

Compute the per-person ceiling — hours per week times weeks — and check every workstream against
it individually. A team total hides the failure mode where one person is over and another is
under. See Lesson 1.

### The reserve and the ordered cut list

Commit only 80–90% of capacity. The rest absorbs integration friction and the sprint that runs
long. Then write the cut list **in priority order, in advance**, so cutting is a lookup rather
than an argument in week ten.

Check the cut list against your hard constraints before accepting it. See Lesson 3.

---

## 3 · Making parallel work actually parallel `[Small team]`

Work is coupled by default. These four artefacts decouple it, and all four are cheap:

| Artefact | What it is | What it frees |
|---|---|---|
| **Frozen contract** | The interface between components, written before either side | Both sides, from each other |
| **Golden fixture** | Real captured input data, committed once | Downstream work, from the input-producing component |
| **Synthetic generator** | A script that fakes a component's output | Everything downstream of the hardest component |
| **Mock service** | A stub answering the contract with canned data | The front end, from the back end |

The synthetic generator is usually the highest-leverage of the four and the one teams skip. On
ProofShape it unblocked an entire workstream about two months before the real component existed.
`[Universal]`

**Write a dependency register.** One row per place where work A waits on work B, naming the
stand-in that removes the wait and the date the real thing arrives. Dependencies you cannot stub
away get solved by *ordering* instead — schedule the producer a full sprint ahead of the consumer.

**Schedule integration points as calendar events.** Days when all other work stops and the parts
are wired together. Without them, integration is discovered rather than planned.

---

## 4 · Stories `[Universal]`

### Sizing

**One story is one pull request is one or two work sessions.** A few hundred changed lines at
most. Review quality collapses on large diffs, and a story that spans a week hides its own
slippage.

For part-time teams this lands around 4 hours per story. Total work divided by 4 gives a
believable story count. `[Part-time]`

### Identity

Prefix by **area**, number by **creation order**. `R-04`, `C-11`, `A-03`.

State explicitly that the number is not a priority and not a sequence. People assume both. The
`Depends on` line is the only ordering that matters. See Lesson 6.

### One file per story, plus an index

The index holds one row each: ID, title, estimate, dependencies, state, owner, link. The story
file holds everything else: acceptance criteria, working notes, decisions, completion record.

Two reasons, both practical. A single long file becomes unnavigable, and two people editing
different stories collide in it constantly.

**The split creates a new failure mode: the same fact now lives in two places, and they will
drift.** An index row and a per-item file both claiming to record one story's state is exactly
the kind of duplication that looks fine until a real merge under real time pressure updates one
and not the other — which happened twice on this project even with the rule written down.
**Write a script that checks the two agree, and reads the dependency graph to say which `Blocked`
stories should now be `Ready`.** See Lessons 20, 22 and 23.

### Acceptance criteria versus definition of done

- **Acceptance criteria** are per story, two to four testable statements. Unique every time.
- **Definition of done** is one team-wide standard applied to everything. It does not vary.

Teams asked to "define done per story" usually mean acceptance criteria. Writing a separate
definition of done per story produces drift until none of them mean anything.

### States

`Blocked` → `Ready` → `Claimed` → `In review` → `Done`. **Ready** is the important one: it means
dependencies are met and nobody has claimed it, so anyone can take it without asking.

**Do not assign "notice what just got unblocked" to a role, including the reviewer who approved
the merge.** It is a mechanical consequence of the dependency graph — compute it, don't delegate
remembering it to whoever happens to be closest. See Lesson 22.

### Claiming, when anyone can pick up anything `[Small team]`

- One person per story, claimed **visibly** before work starts.
- Someone joining to unblock a stuck person is expected, and gets recorded.
- Two people quietly working the same story is the failure this prevents.

### Record actuals

On completion, record who, the date, the pull request, and **actual hours against the estimate**.
Actuals are the only mechanism by which estimates stop being wrong. Everything else is opinion.

### Write one sprint ahead, not all upfront

Elaborate stories for the next sprint at the sprint boundary. Writing the full backlog in detail
at the start is a waterfall plan in agile clothing, and most of it will be wrong before it is
reached.

---

## 5 · Repository and review `[Universal]`

### Public or private

Check what your platform gates behind a paid plan **before** designing the workflow. On GitHub
today: branch protection on private repos needs Pro; deployment approval gates on private repos
need Enterprise; public repositories get all of it free.

For coursework and open projects, public is usually correct and removes the whole question.
`[Graded]`

### Branch protection, the settings that matter

1. Require a pull request before merging
2. Require one approving review
3. Dismiss stale approvals when new commits are pushed
4. Require status checks to pass
5. Require the branch to be up to date before merging
6. Block force pushes and branch deletion
7. **Do not allow bypassing the above** — the one teams forget
8. Require conversation resolution

Then **deploy only from the protected branch**. Deployment becomes gated by construction, which
is simpler and harder to circumvent than a second approval gate.

**Test it, don't just set it.** Attempt a merge without approval and a direct push. Both should
be refused, and the refusal is the evidence.

Warning: item 7 means *nobody* can bypass, including the owner. With one collaborator, nothing
can merge at all. See Lesson 8.

### What never gets committed

Fixtures and captured data, model weights, any secret. Git never forgets: one large file bloats
the repository permanently even after deletion. Fixtures live in cloud storage behind a download
script; commit the script and a checksum.

### Tests ship with the code `[Universal]`

**Any implementation must have its unit tests written and passing in the same pull request.** Not
before as a batch, not afterwards as a batch, and never deferred to a follow-up story.

Three reasons, in order of how much they cost you when ignored:

- **Tests written afterwards are written to pass.** You already know the shape of the code, so you
  test the path you built rather than the paths you missed. They document behaviour; they do not
  find defects.
- **Tests deferred to a follow-up story do not get written.** The follow-up is always the first
  thing cut when a milestone tightens, and by then the code is in production untested.
- **The author forgets the edge cases within days.** The moment you are writing the logic is the
  only moment you still hold every case you decided not to handle.

The narrow exception is behaviour that genuinely cannot be economically automated — a device
permission prompt, a sensor overlay on real hardware. Those get a written manual check, and the
story must state *why* automation was not possible. "It was quicker" is not a reason.

Put it in the definition of done and in the assistant's refusal list, not just in a style guide.
A rule that lives only in prose gets traded away the first time a milestone is close.

**On an AI-assisted team, say explicitly that this is a joint obligation, not the assistant's
alone.** An assistant does not get to skip tests because a particular turn didn't ask for them;
the engineer directing it does not get to skip them because the assistant didn't offer. Left
implicit, "tests ship with the code" quietly becomes something each side assumes the other is
handling — which is a two-person version of exactly the failure the rule exists to prevent.

### Review rules

- Small pull requests. Merge within a day or two.
- Review within 24 hours. Reviewing is the first thing you do in a session, not the last.
- **Never review formatting.** Automate it and let the linter win those arguments.
- Cap work in progress at two per person.

---

## 6 · Instructions for AI assistants `[Universal]`

### File layout

- **`AGENTS.md`** at the repository root — tool-agnostic, the substance. Works across assistants.
- **`CLAUDE.md`** at the root — a pointer to `AGENTS.md` plus anything genuinely Claude-specific.

Splitting it this way is what keeps behaviour consistent when a team uses more than one
assistant. Duplicating the rules in both files guarantees they drift.

### What belongs in the instruction file

1. **What the project is**, in two paragraphs.
2. **Standing rules enforced every session** — the invariants that must not be traded away for
   convenience. Phrase them as rules, not preferences.
3. **Before starting any story**: read the story and everything it touches, check the decisions
   log, check for conflicts with in-flight work, plan before building.
4. **While building**: tests alongside the code rather than batched; comments explaining *why*;
   no silent failures; naming conventions.
5. **What never gets committed.**
6. **Definition of done.**
7. **Repository map.**
8. **Things to refuse or flag rather than do.** An explicit list. This is the section that
   actually prevents damage.

### Supporting documents

| File | Purpose | Why it earns its place |
|---|---|---|
| `docs/decisions.md` | Numbered decisions with reasoning | Stops the same argument recurring monthly |
| `docs/glossary.md` | Project vocabulary | Terms with local meanings get misused otherwise |
| `docs/progress-log.md` | Chronological journal, newest last | Status reports write themselves from it `[Graded]` |
| `docs/story-template.md` | Template for a new story | Consistency without policing |

### The decisions log is the highest-value document here

Every entry: what was decided, when, and **why**. A decision recorded without its reasoning gets
reversed by whoever forgets it — including an assistant in a fresh session with no memory of the
conversation that settled it.

Mark superseded entries rather than deleting them. The original reasoning usually still matters,
and knowing a thing was tried and rejected is worth as much as knowing what was chosen.

Keep an **Open** section for what is genuinely undecided, so unknowns do not silently harden into
assumptions. See Lesson 5.

**Before claiming the next number in the sequence, check every currently open branch, not only
the one you intend to merge into.** Three unrelated branches on one project independently claimed
the same next decision number, each written against its own branch tip. When a collision is
unavoidable, take the next number free everywhere and say so explicitly in the entry, rather than
discovering it at merge time. See Lesson 24.

---

## 7 · Lessons learned

The generalisable ones, each with what triggered it.

**1. Capacity ceilings are per person, not per team. `[Part-time]`**
An even split of shared work pushed one workstream nine hours past one person's semester ceiling
while another finished eleven short. The team total looked fine. *Always check each person
individually against their own ceiling.*

**2. Adding capacity can move you further from a ratio target. `[Graded]`**
Facing a "one third must be X" requirement, the team added an hour per person per week. Spending
only the new feature's hours there would have *lowered* the share, because the denominator grew
faster than the numerator. *When a requirement is a ratio, every added hour must go to the
numerator, or the ratio gets worse.*

**3. Check whether your cut list cuts the thing you are graded on. `[Graded]`**
The ordered cut list dropped the two components that satisfied a hard course requirement first
and second. Any schedule pressure would have removed exactly what was being assessed. *Cross-check
the cut list against every external requirement before accepting it.*

**4. Total hours do not set the date. The serial chain does. `[Universal]`**
93 hours across three people at 27 a week looked like three and a half weeks. About 42 of those
hours could only run one story after another, and a serial chain advances at one person's pace no
matter how many people are free. Five weeks, not three and a half. *Compute the longest dependency
chain. Adding people does not shorten it.*

**5. Inherited dates harden silently. `[Universal]`**
A presentation window came from an earlier draft where it was explicitly marked provisional and
tied to a different course's calendar. Carrying it forward while dropping the caveat let it become
the right-hand edge of two Gantt charts and the anchor for every sprint boundary. *Mark unverified
inputs as unverified in every document that inherits them, and keep an Open section for them.*

**6. Two axes numbered 1–3 will be confused. `[Universal]`**
"Tier 1" (how essential) and "Lane 1" (which area) collided constantly, including in documents
that then contradicted each other. *Number one axis and letter the other.*

**7. Verify plan-gated platform features before designing around them. `[Universal]`**
Branch protection on private repositories needs a paid plan; deployment approval gates need a
higher one still. A workflow was designed around features the team could not have used. *Check
the pricing page, not your memory, before the workflow depends on it.*

**8. A protection rule that admits no exceptions blocks everything until the team exists. `[Small team]`**
Enabling "nobody can bypass" alongside "one approval required" meant that with a single
collaborator, no pull request could merge at all — including the one that set it up. *Correct
behaviour, but sequence adding people before enforcing approval.*

**9. For anything that certifies, a quiet failure is worse than a frequent loud one. `[Universal]`**
Three candidate components ranked one way on speed and the opposite way on how loudly they fail.
The fastest always returns a plausible answer, including when it is wrong. *Rank candidates by
failure visibility, not just failure rate, and build the checks that catch the quiet mode.*

**10. Measure the hardware before designing around an assumption. `[Universal]`**
Benchmarking a laptop took twenty minutes and changed the infrastructure plan, the budget, and one
numeric setting that would otherwise have halved performance silently. *Twenty minutes of
measurement beats a month of architecture built on a guess.*

**11. Do not relabel to satisfy a requirement. Restructure. `[Graded]`**
Asked to frame an existing component as something it was not, the honest answer was that the claim
would not survive a single follow-up question — but there was a real architectural change that
genuinely achieved the goal. *If the framing would lose an argument in the room, change the thing
rather than the label.*

**12. Define the exit criterion before starting a phase. `[Universal]`**
"Get the backend working first" has no end until someone writes down what "working" means. *A phase
without a testable exit criterion never ends; it just gets abandoned.*

**13. Stubs, not sequencing, are what make parallel work possible. `[Small team]`**
A sixty-line script that faked the hardest component's output unblocked an entire workstream months
early. *Ask, for each blocked workstream, what fake would unblock it, and how cheap that fake is.*

**14. The obvious free resources are often traps. `[Graded]`**
Two well-known student cloud credits turn out to exclude the exact resource type the project
needed. A third had been withdrawn entirely. *Verify that a credit covers the specific resource,
not just that the credit exists.*

**15. Reversing your own recommendation is correct when the constraint changes. `[Universal]`**
Advice against one option was sound while a constraint held, and wrong the moment the team removed
that constraint by an unrelated decision. *Record the reasoning with the decision so you can tell
when it stops applying, and reverse explicitly rather than quietly.*

**16. Write the story index and the story detail in different files. `[Universal]`**
Detail accumulates; indexes need to stay scannable; and two people editing one long file collide
on every commit.

**17. Ask the questions that change the work, together, once. `[Universal]`**
Six decisions about how the team wanted to work were answered in a single exchange, and the whole
backlog followed from them. *Batch the blocking questions; do not drip them.*

**18. Story prefixes and directories must be checked against each other. `[Universal]`**
A whole category of work — thirteen stories — had no directory, because the layout came from the
system diagram and the prefixes came later from the work. *List both, map one to the other, and fix
the gap before anyone starts building.*

**19. A rule stated only in prose gets traded away under pressure. `[Universal]`**
"Tests alongside the code" sat in a style section and was still a preference. Moving it into the
definition of done, the story template and the assistant's refusal list is what makes it a rule.
*Put an invariant everywhere it will be checked, not everywhere it will be read.*

**20. Two places storing the same fact will drift, no matter how clearly the rule is documented. `[Universal]`**
An index row and a per-item detail file both claimed to record one story's state, and a plainly
written merge rule was skipped on the very first story it applied to. *Wherever the same fact is
recorded in two places, either derive one from the other automatically, or write a script that
checks they agree — do not rely on a person updating both, however clearly it is asked of them.*

**21. A checklist raises the odds a person does the right thing; it does not verify they did. `[Universal]`**
Adding an update-on-merge item to a pull request template did not, by itself, prevent the same
class of bug on the very next merge, because ticking a box does not compute whether the box's
claim is actually true. *Wherever a check is objectively computable from data already in the
repository, write the check. A checklist is the fallback for what automation genuinely cannot
reach, not a substitute for automating what it can.*

**22. A cascading consequence of a status change belongs to a script, not to whoever is closest. `[Universal]`**
Completing one item should have unblocked two others; nothing did that automatically, and the
question that followed — should this be the approver's job — would only have relocated the same
forgettable step onto a different person. *If "when X finishes, check whether Y is now unblocked"
can be computed from data already on hand, write the few lines of code once, rather than asking a
rotating cast of humans to remember it under pressure.*

**23. The strongest test of a fix is the real, still-live bug it was written to catch. `[Universal]`**
A verification script was run against the actual unresolved instance of the defect, on a branch
that predated its fix, before being trusted — a stronger proof than any invented example could
give. *Before wiring a new check into policy, point it at a real, currently broken case and
confirm it fires correctly, then confirm it correctly leaves adjacent, legitimately unresolved
cases alone.*

**24. A shared incrementing identifier collides across concurrent branches; check all of them. `[Universal]`**
Three separate branches independently claimed the same next sequence number for unrelated
decisions, each written against only its own branch tip. *Before claiming the next number in a
sequence, check it against every open branch, not only the one you intend to merge into — and
when a collision is unavoidable anyway, take the next number free everywhere and say so
explicitly, rather than silently hoping to be first.*

**25. An independent fix belongs on its own branch off the trunk, not stacked on a large pending one. `[Small team]`**
A one-line correction was nearly built on top of an unrelated, not-yet-approved multi-file
revision, which would have forced the small fix to wait on a decision it had nothing to do with.
*Branch a small, unrelated fix from the current stable tip even when a larger in-flight branch is
further along — stacking on it couples two things that do not need to be coupled.*

**26. Before treating a diff as lost work, check which branch it actually lives on. `[Universal]`**
Content that had genuinely been written earlier appeared to be missing after switching branches;
it was not lost, it was sitting, uncommitted-to-trunk, on a different branch that had never
merged. *A surprising absence right after a branch switch is usually a location question, not a
data-loss one — check history across all branches before concluding anything was destroyed.*

---

## 8 · What is specific to ProofShape `[ProofShape]`

Do not copy these into another project without re-deriving them.

- **The tier boundary.** "Photos in, 3D model out" as Tier 1 and inspection as Tier 2 is specific
  to this product. The *practice* of tiering is universal; this particular split is not.
- **The three-lane split.** Capture, reconstruction, inspection maps to this system's shape.
- **The hard rule about unobserved geometry.** A domain invariant for measurement and
  certification systems. Other domains have their own invariant — find it and state it as
  plainly. The *practice* of naming one inviolable correctness rule is what transfers.
- **The generative-AI proportion requirement.** A course rule. The transferable part is Lesson 2
  and Lesson 3, which apply to any externally imposed ratio.
- **Specific technology choices** — the reconstruction backbone, the fusion library, the reference
  sheet design. All domain-specific.
- **The biweekly review cadence.** Course-imposed. The transferable part is the fixed four-slide
  template that makes a recurring report cheap.
- **Backend-first sequencing.** Correct here because the reconstruction engine was both the
  riskiest and the most depended-upon component. Only correct elsewhere when both are true.

---

## 9 · Artefacts to produce, in order `[Universal]`

For a new project, produce these in this sequence. Each depends on the last.

1. **Answers to Part 1.** From the team, not inferred.
2. **A tiered scope statement.** Must, should, could, and an explicit not-doing list.
3. **A capacity table.** Per person, against their individual ceiling.
4. **Milestones with falsifiable gates** and named fallbacks.
5. **A decoupling plan.** The contract, fixtures, stubs, and a dependency register.
6. **A story backlog.** Detailed one sprint ahead, titles beyond that. Index plus per-story files.
7. **The critical chain,** computed and stated, with the date it implies.
8. **`AGENTS.md` and `CLAUDE.md`.**
9. **`docs/decisions.md`,** seeded with every decision made while producing items 1–8.
10. **Repository setup:** protection rules, gitignore, CI skeleton, and a test that the gate works.
11. **An ordered cut list,** cross-checked against every hard requirement.

If you are an assistant, produce these as files, not as chat messages. Show the arithmetic for
items 3 and 7.

---

## 10 · Maintaining this document

Add a lesson when something surprises you, not when a task completes. The trigger for a new entry
is "I would do that differently next time."

Each lesson gets: what happened in one sentence, the generalisation in italics, and a
transferability marker. Keep them numbered and never renumber — reference stability matters more
than tidiness.

Review at each project retrospective and at the end of a project. Move anything proven wrong to a
struck-through note rather than deleting it.

### Changelog

- **2026-09-06** — created, from the ProofShape planning phase. 17 lessons, seeded from planning,
  repository setup, and the first story.
- **2026-09-06 (later)** — added the tests-ship-with-the-code rule as a standing practice, added
  guidance on mapping story prefixes to directories, and added lessons 18 and 19.
- **2026-09-11** — added lessons 20–26, from a run of three real bugs in story-state tracking
  (a merged story left `In review`; an index updated without its story files; the fix for the
  first bug itself colliding with an unrelated branch's decision numbering) and how each was
  actually fixed: a mechanical consistency-and-cascade script rather than a stronger rule, tested
  against the live unresolved bug before being trusted, plus the cross-branch numbering check
  that came out of resolving it. Strengthened §4 and §6 with pointers to these in the prescriptive
  text, not only in the retrospective list.
- **2026-09-12** — added the joint-accountability note to "Tests ship with the code" (§5): on an
  AI-assisted team the rule needs to name both the engineer and the assistant explicitly, or each
  quietly assumes the other is covering it.
