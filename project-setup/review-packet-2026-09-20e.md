# Catalog review packet — category-specific requirements (batch 5: batteries, toys, WEEE, UK marking)

**Date:** 2026-09-20 · **Requirements:** 7 (every remaining draft except `uk.gpsr.uk-responsible-person`,
which stays held pending PRMA 2025 secondary legislation — not a research gap, see its own
`sources` note). **Outcome of this pass:** citations upgraded from secondary guidance to primary
statutory text for all seven; **two real date bugs found and fixed**; no other scoping questions
surfaced — this batch was mostly citation verification, not applicability logic. **No `state`
changes** — same discipline as every prior packet.

## The seven

| Requirement | What changed |
|---|---|
| `eu.flag.battery-registration` | ❗ Citation fixed (Art. 56 → **Art. 55**) and a **date bug fixed**: effective_from was a year early. |
| `uk.batteries.producer-registration` | Citation confirmed (regs. 9/26/42-45) and a **date bug fixed**: effective_from was 3 months late. |
| `eu.flag.toy-safety` | Citation already correct (Art. 4, 15). Verified, no changes. |
| `uk.toys.safety` | ❗ Citation fixed (regs. 15, 18) and a **date bug fixed**: effective_from was a month early. |
| `eu.flag.weee-registration` | Citation already correct (Art. 16). Verified, no changes. |
| `uk.weee.producer-registration` | Citation fixed (regs. 15-17, 5-tonne threshold confirmed). No date issue. |
| `uk.marking.ukca-or-ce` | Citation fixed (SI 2024/696, the actual basis for indefinite CE recognition). No date issue. |

## The two date bugs (the actual finding of this batch)

Unlike the last two batches, this one had almost no scoping ambiguity — these are narrower,
mechanical requirements (register, mark, declare). But two of the seven had their `effective_from`
wrong by a meaningful margin, which is a correctness bug, not a style one: a SKU could be told it
needed to comply with a duty before that duty existed, or (worse, the more common direction of
error) after.

1. **`eu.flag.battery-registration`**: drafted as `2024-08-18` (a real date from the Regulation,
   but the wrong one — it's when several *other* provisions, like the separate-collection symbol
   requirement, took effect). Art. 96 states plainly that **Chapter VIII** — which contains Art. 55,
   the registration article — **applies from 18 August 2025**, a full year later. Fixed.

2. **`uk.toys.safety`**: drafted as `2011-07-20`, copied from the EU Directive's own date "by
   analogy," per the original note. The UK SI's own commencement clause (reg. 1(2)) is
   **19 August 2011**, a month later. Fixed.

`uk.batteries.producer-registration` also moved, in the other direction: from `2010-01-01` to
`2009-10-15`, since the actual registration duties (regs. 26, 42) took effect three months before
the drafted date, not after it.

## One nuance surfaced, not modelled (flagging, not fixing)

`uk.batteries.producer-registration`'s 1-tonne "small producer" threshold, confirmed correct, only
applies to **portable** batteries. Industrial and automotive batteries have their own, thresholdless
registration track (reg. 42 — register directly with the Secretary of State regardless of volume).
The row's `applies_when` doesn't distinguish battery type, so it isn't wrong to say registration
applies either way — but the specific route and threshold shown to a customer should differ by
battery type. Left unmodelled this pass since it doesn't create a false positive or negative,
only an imprecise "how."

## Recommendation

All seven are citation-clean now with no open scoping question. Recommend publishing all seven on
sign-off — this batch didn't surface anything requiring the kind of applies_when decision the last
two batches needed.

## Sources

Full verbatim citations recorded on each requirement's own `sources` array.
