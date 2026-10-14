# Review · `ie.epr.packaging-repak`

**Researched 14 October 2026; revised the same day after an external review (D-063).** Ireland's
national packaging layer. The EU-wide PPWR duties (producer registration, Art. 44; authorised
representative for non-established sellers, Art. 45(3)) already apply to Ireland through
`eu.ppwr.*`. This entry adds what is Irish: *how* a producer meets the duty there.

## What our JSON claims

> **Regulation:** S.I. No. 282/2014 + PPWR · **Article:** regs. 10, 13, 17; PPWR Arts. 44(2), 44(8), 46(1), 47(1)
> **Applies when:** market is IE **and** the product has packaging (no threshold)
> **Needs:** `packaging.ie_repak_number` + an `epr_certificate` that expires
> **Effective from:** 12 August 2026 · **Drafted at:** medium
> **In one line:** a seller without Irish premises, in practice, joins Repak.

## What the sources say

**S.I. No. 282/2014 (as made)**

- Reg. 3(3)(a), the old threshold: a "major producer" supplies over 10 tonnes of packaging a
  year **and** has turnover over €1 million.
- Reg. 13(1), self-compliance: "in respect of each premises specified in regulation 10(1)(a)",
  register with that premises' local authority and renew "not later than the 31st day of
  January in each year".
- Reg. 10(1): at each premises, a public notice "within one metre of each entrance", facilities
  to accept and segregate packaging waste, and free acceptance of packaging waste "between the
  hours of 9.30 a.m. to 5.30 p.m., each Monday to Friday".
- Reg. 17(1): a certificate from an approved body exempts the producer "from the requirements of
  regulations 10 to 16 and 25".

**S.I. No. 167/2025** — the only amendment found. It adds a definition of "Minister" and nothing
else.

**PPWR (Official Journal text)**

- **Art. 44(2):** "Producers shall be obliged to register … in each Member State where they make
  packaging or packaged products available … for the first time." No threshold. "Where a producer
  has entrusted a producer responsibility organisation … the obligations set out in this Article
  shall be met by that organisation, unless otherwise specified by the Member State."
- **Art. 44(8):** under 10 tonnes a year, a lighter annual report (Annex IX, Part B point 2).
  This is not a registration exemption.
- **Art. 44(1):** national registers are due "within 18 months of the date of entry into force of
  first implementing act" under Art. 44(14). That act was still a Commission draft in August 2026
  (D-055).
- **Art. 46(1):** "Producers may entrust a producer responsibility organisation … Member States
  may adopt measures to make entrusting … mandatory."
- **Art. 47(1)–(2):** individual fulfilment needs an authorisation from the competent authority;
  Member States "shall establish the requirements and details of the authorisation procedure".

**S.I. No. 541/2025:** the Minister is the competent authority for PPWR Arts. 44–47.

**Repak's page** (an interested party): "required under PPWR to register with Repak".

## Assessment

1. ✅ **No registration threshold since 12 August 2026.** PPWR Art. 44(2) has none, and no
   Irish instrument says otherwise: every 2025 and 2026 S.I. title and every 2026 Act was
   checked. The 10-tonne line survives only as a lighter reporting tier (Art. 44(8)).
2. ✅ **For a seller without Irish premises, Repak is the practical route.** The 2014
   self-compliance route is built around Irish premises (regs. 10, 13). PPWR's individual route
   needs an authorisation procedure Ireland hasn't published (Art. 47).
3. ❗ **Not "the only legal route".** PPWR makes a scheme optional unless a country mandates it
   (Art. 46(1)). No Irish measure mandating it was found, so the entry says "in practice".
4. ❓ **Repak as the *sole* approved body** is still unverified from a primary source. The
   summary avoids claiming it.
5. ℹ️ **Joining Repak may also cover PPWR registration** (Art. 44(2)), which is why
   `required_data` asks for the Repak number.
6. ℹ️ **Not modelled:** Repak's fees; Northern Ireland (UK); the pre-August major-producer regime
   (`effective_from` is 12 August 2026).

**Recommendation: publish at `medium`.** Points 1–3 rest on primary text. Point 4 is not relied on.

## To publish

```bash
npm run catalog:publish -- ie.epr.packaging-repak --reviewer "Tabeen Raoof" --confidence medium --read 1
```

`--read 1` asserts you opened source 1 (PPWR, Arts. 44–47). Use `--read 0` if you checked S.I.
No. 282/2014 instead. Publishing changes the live catalog, so **bump `packages/catalog/catalog.json`
in the same commit** (D-063). Then Ireland can be added to `apps/scanner/markets.ts` and
`apps/web/src/domain/markets.ts`; the build and `apps/scanner/test/markets.test.ts` refuse it until
this is published.
