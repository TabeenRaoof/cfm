# Catalog review packet — national packaging-EPR schemes (batch 4: AT, BE, ES, IT, NL)

**Date:** 2026-09-20 · **Requirements:** 7 (the whole batch `review/epr-national-schemes.md`
flagged as "review together") · **Outcome of this pass:** citations upgraded from secondary
guidance to primary law/treaty text for all seven; **no `state` changes** — several genuine
scoping questions surfaced that need your call before any of these ship, same discipline as the
PPWR AR row at PR #4.

## The seven

| Requirement | What changed this pass |
|---|---|
| `nl.epr.packaging-verpact` | Threshold (50,000 kg) confirmed against the statute: **Art. 8(1) Besluit beheer verpakkingen 2014**. Ready to publish as-is. |
| `es.epr.authorised-representative` | Citation confirmed: **Art. 17.2 RD 1055/2022**, including the first-distributor fallback the summary already describes. Ready to publish as-is. |
| `es.epr.packaging-rpp` | Citation confirmed: **Art. 14-16 RD 1055/2022**. Ready to publish as-is. |
| `at.epr.packaging-edm` | Citation confirmed: **§ 13g(1) AWG 2002**. Ready to publish as-is. |
| `be.epr.packaging-ivc` | ❗ **Scoping question** — see below. |
| `at.epr.authorised-representative` | ❗ **Scoping question** — see below. |
| `it.epr.packaging-conai` | ❗ **Scoping question, the biggest one** — see below. |

## Ready to publish (4)

Four of the seven now have a solid primary-source citation and no open logic question:
`nl.epr.packaging-verpact`, `es.epr.authorised-representative`, `es.epr.packaging-rpp`,
`at.epr.packaging-edm`. Their `sources` arrays carry the full verified citation and reasoning;
happy to flip `state` to `published` on your sign-off, same as prior batches.

One nuance worth knowing even though it doesn't block publishing `nl.epr.packaging-verpact`:
single-use-plastic and deposit-return packaging (cans, plastic bottles) have **no** 50,000 kg
threshold under Verpact's own guidance — registration is required from the first unit. Not
modelled; flagging as a known gap rather than blocking the row on it.

## Three scoping questions, held pending your decision

### 1. Italy — does this row even apply to a non-Italian-established seller? (`it.epr.packaging-conai`)

CONAI's own English page, corroborated independently by a second Italian source, states plainly:
**"Foreign companies are not obliged to join CONAI, but they may do so voluntarily."** If that's
right, a non-Italian-established e-commerce seller shipping into Italy — CFM's primary customer
shape — may not be the party this row's obligation attaches to at all. Responsibility might
instead fall on whichever Italian-established party imports/distributes the goods, the same
shape as Spain's first-distributor fallback in this same batch. I have **not** read the actual
D.Lgs. 152/2006 Art. 221/218 text that would settle this — flagging rather than guessing, because
getting it wrong here isn't a citation nit, it's telling the wrong customer they're covered (or
not) for an entire EU market.

### 2. Belgium — is there really no threshold? (`be.epr.packaging-ivc`)

The Cooperation Agreement's own English treaty text sets **Art. 6's take-back obligation
(join Fost Plus/Valipac) at "at least 300 kg of packaging on the market per year"** — a real
threshold — and ties **Art. 18's reporting duty** to "the responsible company subject to the
take-back obligation," i.e. the same 300 kg-gated population. That contradicts this row's summary
("There is no de minimis threshold"), which came from IVC/CIE's own guidance page saying the
reporting duty applies to "any company." Both are now in the `sources` array; I didn't pick a
winner. Possibilities: the guidance page reflects an amendment to the 2008 text I haven't found,
or it's describing best practice rather than the legal floor. Recommend either finding that
amendment, or adding a 300 kg threshold to `applies_when` (same shape as the NL row).

### 3. Austria — mandatory only for sales to private consumers? (`at.epr.authorised-representative`)

Same underlying issue as the PPWR AR row you held at PR #4 (D-040) — and the fix, if you want it,
is the exact same fact. § 12b(1) AWG 2002 makes AR appointment **mandatory** only for distance
sellers with no AT seat selling to **private** end consumers (§ 13g(1)(5)). A seller with no AT
seat selling only to businesses gets an **optional** appointment right under § 16a, not a duty.
The row's current summary claims "no distance-selling carve-out," which the statute doesn't
support once you split by private vs. business buyer. Recommend adding
`organisation.sells_direct_to_end_users: true` to `applies_when`, reusing D-040's fact rather than
inventing a new one — but leaving that edit for your sign-off rather than applying it here.

## Recommendation

Publish the four clean ones now if you agree with the read above; hold the three scoping
questions for a follow-up pass once you've decided each (same pattern as the PPWR AR
rescope — held at review, fixed in a dedicated PR, republished once resolved).

## Sources

All primary-source URLs and full verbatim citations are recorded on each requirement's own
`sources` array, not repeated here.
