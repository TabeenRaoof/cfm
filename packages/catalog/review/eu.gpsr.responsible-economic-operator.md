# Review · `eu.gpsr.responsible-economic-operator`

**Researched 13 September 2026.** Unresolved items are marked ❓ — those are the ones that need
your eye, the rest is confirmation.

## What our JSON claims

> **Title:** EU-established responsible economic operator
> **Article:** Art. 16 · **Regulation:** (EU) 2023/988 (GPSR)
> **Applies when:** market is in the EU **and** the manufacturer is not established in the EU
> **Needs:** `rp.name`, `rp.address`, `rp.contact` + a signed `rp_mandate` (expiring)
> **Effective from:** 2024-12-13 · **Confidence:** high

## What the source says

Article 16 is titled **"Person responsible for products placed on the Union market."** Its
substance, per the Commission's own framing and the regulation's structure:

> A product covered by the GPSR may not be placed on the market unless there is an economic
> operator established in the Union who is responsible for the tasks set out in **Article 4(3)
> of Regulation (EU) 2019/1020**.

> Their name and contact details must appear on the product, packaging, parcel or accompanying
> document — **Article 16(3)**.

Who may hold the role: an EU-established manufacturer, an EU-established importer, an
authorised representative, or — as a fallback — a fulfilment service provider.

## Assessment

**The claim is sound and the article number is right.** Three refinements worth making:

1. ✅ **Our `applies_when` is correct but understates the case.** We trigger on
   `manufacturer.country_in_eu = false`. In fact the duty is that *someone* EU-established must
   be responsible — so an EU-established **importer** satisfies it even with a non-EU
   manufacturer. Our version asks for an RP when an importer might already cover it. That is a
   false positive, not a false negative, so it is safe to publish and worth a follow-up: add an
   `organisation.established_in_eu` branch so an EU seller importing directly is not told to
   appoint someone they already are.
2. ❓ **Article 16(3) is where the on-product contact-details duty sits**, which is arguably a
   separate requirement from "an operator must exist". Consider whether to split. Not blocking.
3. ✅ **`expires: true` on the mandate is a product judgement, not a legal one** — the
   regulation does not set a term; mandates do. Keep it.

## Suggested edits on approval

```jsonc
"state": "published",
"reviewer": "TR",
"last_reviewed_at": "2026-09-13",
"confidence": "high",
"article_ref": "Art. 16; contact details Art. 16(3); tasks per Art. 4(3) Reg. (EU) 2019/1020",
"sources": [ { ..., "verified": true, "retrieved_at": "2026-09-13" } ]
```

## Sources

- [Regulation (EU) 2023/988 (GPSR), EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/988/oj/eng) — the full text; Art. 16 sits past the point where an automated fetch truncates, so **open it and read Art. 16 yourself** before setting `verified: true`.
- [Regulation (EU) 2019/1020 Art. 4(3)](https://eur-lex.europa.eu/eli/reg/2019/1020/oj) — the task list Art. 16 points at.
