# Review · national packaging EPR schemes (ES, IT, NL, AT, BE)

Seven requirements reviewed together, because they are the same shape five times: *register
with the national body, join a scheme, hold an identifier*. Reviewing them as a batch is much
faster than one at a time, and the differences between them are the interesting part.

**Researched 13 September 2026 — and this batch is weaker evidence than the GPSR packets.**
Everything below comes from secondary sources: compliance-provider guidance and registry
homepages. Several independent providers agreed on each scheme, which is reassuring but is not
a primary source. **All seven are `confidence: low` and none should be published without
opening the national registry.**

## The batch

| Requirement | Body | Threshold | Representative needed? |
|---|---|---|---|
| `es.epr.packaging-rpp` | RPP (MITECO) + a SCRAP | **None** — from the first unit | — |
| `es.epr.authorised-representative` | — | — | **Yes**, if not established in ES |
| `it.epr.packaging-conai` | CONAI + material consortium | Not established | — |
| `nl.epr.packaging-verpact` | Verpact (ex-Afvalfonds) | **> 50,000 kg/year** | — |
| `at.epr.packaging-edm` | EDM portal + a system (ARA et al.) | Not established | — |
| `at.epr.authorised-representative` | — | — | **Yes**, since 1 Jan 2023 |
| `be.epr.packaging-ivc` | IVC/CIE + Fost Plus / Valipac | **None** | — |

## What to check, in priority order

1. ❗ **The Dutch 50,000 kg threshold is the single most consequential number here.** It is the
   only one of the five that exempts a seller entirely, so getting it wrong is either telling a
   small seller they must register when they need not, or — worse — telling a large one they
   need not when they must. Confirm against Verpact or the Besluit before publishing.
   If you cannot confirm it, **remove the threshold clause rather than guessing**: without it
   the requirement applies to everyone, which is the safe direction and honest.

2. ❗ **Do Italy and Belgium have thresholds we have missed?** Our drafts say no for Belgium
   ("no de minimis") and are silent for Italy. A missing threshold makes the requirement apply
   too widely — a false positive, so safe to publish — but it is worth knowing.

3. ❓ **Spain's fallback is commercially interesting and should probably be surfaced.** Where no
   *representante autorizado* is appointed, responsibility passes to the first Spanish
   distributor. That means a seller may genuinely believe they are covered because someone
   downstream is carrying it — exactly the kind of thing that makes the tool worth using. It is
   in the `summary`; consider making it more prominent.

4. ❓ **Does the generic `eu.ppwr.producer-registration` now double up?** A Spanish seller sees
   both the PPWR registration row and the RPP row. That is defensible — PPWR is the EU duty,
   the RPP is how Spain implements it — but the two summaries need to read as complementary
   rather than as a bug. Worth a pass over the wording once you have reviewed both.

5. ❓ **Austria's 1 January 2023 representative date** is from one provider. Since `effective_from`
   drives whether the requirement appears at all, confirm it.

## The eighth requirement in this batch

`eu.flag.weee-registration` — Directive 2012/19/EU, producer registration per member state for
electrical goods. Flag-only, sitting beside the existing battery flag. Art. 16 is the
registration article by the directive's structure but has **not** been read. National
implementations differ substantially and none is modelled.

## Recommendation

**Do not review this batch until the four GPSR/DE packets are published.** Those four are
higher-confidence, cover every EU market, and make the scanner credible on their own. This batch
is depth, and depth that is `low` confidence adds rows a seller cannot act on.

When you do get to it, the fastest order is: confirm the Dutch threshold, then open each
registry homepage and confirm the body's name and that registration is required from the first
unit. That is perhaps 90 minutes for all seven, and it moves them from `low` to `medium`.

## Sources

All secondary. Listed on each requirement's `sources` array with a note saying so.

- [Verpact](https://verpact.nl/) · [CONAI](https://www.conai.org/) · [IVC/CIE](https://www.ivcie.be/) · [EDM Austria](https://edm.gv.at/) · [MITECO](https://www.miteco.gob.es/)
- [Directive 2012/19/EU (WEEE), EUR-Lex](https://eur-lex.europa.eu/eli/dir/2012/19/oj)
