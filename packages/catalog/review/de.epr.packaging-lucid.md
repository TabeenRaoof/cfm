# Review · `de.epr.packaging-lucid`

**Researched 13 September 2026.** This one has the most open questions of the four.

## What our JSON claims

> **Regulation:** Verpackungsgesetz (VerpackG) · **Article:** § 9, § 7
> **Applies when:** market is DE **and** the product has packaging
> **Needs:** `packaging.lucid_number` + a dual-system `epr_certificate` · **Confidence:** medium

## What the sources say

> Registration under **§ 9 VerpackG** applies to manufacturers and first distributors: producers
> must apply to the LUCID packaging register with the type of packaging and confirmation of
> nationwide return and disposal.

> **§ 7 VerpackG** carries the system-participation obligation — a contract with a dual system —
> and that must be fulfilled before LUCID registration can be completed.

> Any business introducing packaging into the German market must register: manufacturers,
> importers, online retailers, and companies selling packaged goods to German customers from
> abroad.

**A detail worth knowing that is not in our JSON:**

> No third party may be commissioned to register under § 9 VerpackG or to submit data reports
> under § 10 — it is a personal obligation of the company.

## Assessment

✅ **The § numbers are right and our sequencing is right.** Four things:

1. ✅ **Non-German sellers are in scope**, confirming our `applies_when` does not need an
   establishment condition. Good.
2. ❗ **The "no third parties" rule is commercially important and should be surfaced.** It means
   this is a requirement we can *track* but never *do for them*, and a seller who assumed their
   bureau handled it may be unregistered. Put it in `summary`; it is the kind of thing that
   makes a seller trust the tool.
3. ❗ **§ 10 (data reporting) is a separate recurring duty** and is not modelled at all.
   Registration is one-off; reporting is periodic. Probably its own requirement, and it is
   exactly the sort of thing the expiry/calendar work in v2 exists for.
4. ❓ **Scope limit unverified.** Our condition is "has packaging", but the obligation attaches
   to packaging that typically ends up with private final consumers
   (*systembeteiligungspflichtige Verpackungen*). B2B-only packaging may sit outside it. This is
   the one thing I would not publish without checking — it is the difference between telling
   every seller they must register and telling the right ones.

**Recommendation: publish at `medium` once you have checked point 4**, or publish now with the
`summary` narrowed to say the obligation covers consumer-facing packaging.

## Suggested edits on approval

```jsonc
"summary": "Packaging that typically ends up with private final consumers must be registered in the LUCID packaging register (§ 9) before it is placed on the German market, and a dual-system contract must be in place (§ 7). Registration is a personal obligation: no third party may do it for you. Non-German sellers shipping to German customers are in scope.",
"state": "published", "reviewer": "TR", "last_reviewed_at": "2026-09-13", "confidence": "medium"
```

Follow-up requirement to draft: `de.epr.packaging-data-reporting` (§ 10, recurring).

## Sources

- [Zentrale Stelle Verpackungsregister (ZSVR)](https://www.verpackungsregister.org/en/) — the register itself and the authority.
- [Verpackungsgesetz — gesetze-im-internet.de](https://www.gesetze-im-internet.de/verpackg/) — **read § 3 (definitions), § 7 and § 9 here before setting `verified: true`.** § 3 is where point 4 is settled.
