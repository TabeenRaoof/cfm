# Review · `ie.epr.packaging-repak`

**Researched 14 October 2026.** Ireland's national packaging layer. The EU-wide PPWR duties
(producer registration, Art. 44; authorised representative for non-established sellers,
Art. 45(3)) already apply to Ireland through `eu.ppwr.*` — this entry adds only what is Irish:
*how* a producer meets the duty there.

## What our JSON claims

> **Regulation:** S.I. No. 282/2014 + PPWR · **Article:** regs. 13, 17; PPWR Arts. 44, 45
> **Applies when:** market is IE **and** the product has packaging (no threshold)
> **Needs:** `packaging.ie_repak_number` + an `epr_certificate` that expires
> **Effective from:** 12 August 2026 · **Drafted at:** medium

## What the sources say

**S.I. No. 282/2014, reg. 3(3)(a)** — the old threshold:

> "“major producer” means a producer who— (i) … sells or otherwise supplies to other persons
> packaging material, packaging or packaged products, where the aggregate weight … exceeds or may
> be expected to exceed 10 tonnes in a calendar year, and (ii) has an annual turnover of more
> than €1million"

**Reg. 13(1)** — self-compliance, renewed yearly:

> "a major producer shall … (a) apply for registration to the local authority in whose functional
> area the premises is situate … and (b) apply for renewal of such registration to the relevant
> local authority, not later than the 31st day of January in each year following initial
> registration"

**Reg. 17(1)** — joining a scheme instead:

> "A producer to whom is granted a certificate by an approved body stating that such producer is
> participating, in a satisfactory manner, in a scheme for the recovery of packaging and
> packaging waste shall be exempt from the requirements of regulations 10 to 16 and 25"

**S.I. No. 541/2025, reg. 3(2)** — the Minister is the competent authority for PPWR Arts. 44
and 45. It names authorities only; it doesn't change thresholds or say how to register.

**Repak's own page** (an interested party, not law): "Businesses that place packaging on the Irish
market are required under PPWR to register with Repak and will be subject to the relevant EPR
fee."

## Assessment

1. ✅ **The two routes are right.** Join Repak (reg. 17) or self-comply with local-authority
   registration renewed every 31 January (reg. 13).
2. ❓ **The "no threshold since 12 August 2026" claim rests on PPWR, not Irish law.** No Irish
   instrument removing the 2014 threshold was found. The claim is that PPWR's Art. 44/45 duties
   carry no threshold and apply directly. **This is the one thing to check before publishing:**
   open PPWR Arts. 44 and 45 and confirm neither sets a tonnage or turnover exemption.
3. ❓ **Only the as-made 2014 text was read.** Amendments since 2014 could have renumbered
   regulations or changed the threshold. If you can, open the revised text on the Irish Statute
   Book (or the Law Reform Commission's revised edition) and check regs. 3, 13 and 17.
4. ❗ **Ireland's PPWR producer register isn't running yet.** A compliance provider reported
   this on 4 October 2026; the government hasn't published the route. The summary says so. In
   practice marketplaces accept a Repak number, which is why `required_data` asks for it.
5. ℹ️ **Not modelled:** Repak's fees (they vary by material, weight and turnover band), and
   Northern Ireland, which is UK.

**Recommendation: publish at `medium`** once point 2 is checked. Point 3 is worth five minutes
but not a blocker; if you skip it, say so and it stays in the source note.

## To publish

```bash
npm run catalog:publish -- ie.epr.packaging-repak --reviewer "Tabeen Raoof" --confidence medium --read 0
```

`--read 0` asserts you opened source 0 (S.I. No. 282/2014). Then Ireland can be added to the
market lists (`apps/scanner/markets.ts`, `apps/web/src/domain/markets.ts`) — the build and
`apps/scanner/test/markets.test.ts` refuse it until this is published.
