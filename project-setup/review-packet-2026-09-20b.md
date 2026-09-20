# Review packet 2 — 4 requirements, 20 September 2026

Second batch. Picked per D-034 (general goods over category-specific depth): the four broadest,
jurisdiction-wide EU/UK GPSR requirements still in draft, rather than a category flag like toys or
batteries. Same rule as batch 1: `state`, `reviewer`, `last_reviewed_at` are untouched — that's
yours to set, per D-008.

## 1. `eu.gpsr.technical-documentation` — citation corrected, ready to sign

The draft cited `Art. 9(2), Annex`. Fetched the Regulation directly: Art. 9(2) is exactly the
technical-documentation duty the summary describes, and Art. 9(3) is the separate 10-year
retention duty the summary also asserts — but there is no substantive "Annex" about
technical-documentation content. This Regulation's only Annex, checked directly, is a correlation
table mapping the old product-safety Directive to this Regulation's articles. Changed
`article_ref` to `Art. 9(2)-(3)`, which is what actually says what the summary claims.
**Ready to sign off.**

## 2. `eu.gpsr.manufacturer-identification` — citation tightened, ready to sign

Confirmed against the text: Art. 9(6) is exactly the "name on the product or packaging" duty.
Tightened `article_ref` from the general `Art. 9` (which covers seven distinct manufacturer
duties across its paragraphs) to the specific `9(6)` — the same kind of ambiguity the France row
in batch 1 had, caught before publishing rather than after. **Ready to sign off.**

## 3. `uk.gpsr.general-safety-requirement` — confirmed correct, ready to sign

Re-fetched the statute directly. Part 2, reg. 5 is titled exactly "General safety requirement" —
the citation was already right, just previously unverified. **Ready to sign off.**

## 4. `uk.gpsr.uk-responsible-person` — not ready; this is a scoping question, not a citation fix

This is the batch's real finding, and it's bigger than the other three combined.

**The citation is wrong**: reg. 8 of GPSR 2005, as cited, is titled "Obligations of distributors"
— nothing to do with appointing anyone.

**But the deeper problem is the premise.** As far as I could establish (a specialist compliance
guide dated February 2026, corroborated by reading the Act itself), **there is currently no
blanket UK Responsible Person requirement for general consumer goods.** The Product Regulation
and Metrology Act 2025 is an *enabling* Act — it grants the power to create a UKRP requirement
through future secondary legislation, which has not yet been made. What GPSR 2005 actually does
today: if the manufacturer isn't UK-established, the "producer" duties fall to a UK-established
representative *if the manufacturer happens to have appointed one* — otherwise to whichever
UK-established importer places the product on the GB market. There is no duty today to appoint
someone specifically, unlike the EU's Art. 16 (which this catalog already publishes correctly).
A general-purpose, jurisdiction-wide UKRP duty already exists today only in specific sectors —
cosmetics and medical devices are two I could confirm — not for general goods under GPSR.

**Decision needed, not a sign-off:** this row as titled and scoped doesn't appear to describe
current law. Three ways to go, and I don't think this one is mine to pick:

- **(a) Hold it.** Leave it a draft (or set an `effective_from` in the future) until PRMA 2025's
  secondary legislation actually exists, and track re-checking it as a recurring item rather than
  a one-off.
- **(b) Rescope it** to describe today's actual, much weaker rule — the importer-of-last-resort
  duty — which is real, but telling a customer "you may need to appoint a UK responsible person"
  when the true position is "your UK importer inherits some duties by default" is a materially
  different claim.
- **(c) Split by sector** into rows for categories where a UKRP already is required today
  (cosmetics, medical devices), if those product categories matter to this catalog at all.

The draft already carried `confidence: "low"` — whoever wrote it may have suspected this.

---

## What I did not touch

Same as batch 1: `state`, `reviewer`, `last_reviewed_at` on all four files. For the first three,
everything else needed is already updated and checked. For the fourth, I deliberately did **not**
apply a citation fix, because I don't think there's a small fix here — the finding above is what
needs your decision before anything about this row is worth correcting.
