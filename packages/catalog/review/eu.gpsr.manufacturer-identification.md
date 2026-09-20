# Review · `eu.gpsr.manufacturer-identification`

**Researched 13 September 2026.**

## What our JSON claims

> **Article:** Art. 9 · **Applies when:** market is in the EU (unconditional within the EU)
> **Needs:** `manufacturer.name`, `manufacturer.address` · **Confidence:** high

## What the source says

Read directly from the EUR-Lex text of Regulation (EU) 2023/988:

> **Article 9(6):** "Manufacturers shall indicate their name, their registered trade name or
> registered trade mark, their postal and electronic address" — placed "on the product or, where
> that is not possible, on its packaging or in a document accompanying the product."

## Assessment

✅ **The requirement is real and the obligation is as we state it.** Two corrections:

1. ❗ **The article reference should be Art. 9(6), not bare Art. 9.** Article 9 covers
   manufacturers' obligations generally; the identification duty is paragraph 6. Tighten it —
   the citation is shown to the customer, so precision is the feature.
2. ❗ **We are missing a required field.** The text requires a **postal *and* electronic**
   address. Our `required_data` has `manufacturer.name` and `manufacturer.address` but no
   electronic address. Add `manufacturer.contact`.

Also note the source permits the trade name or trade mark *instead of* the registered name.
Our single `manufacturer.name` field collapses those; acceptable for v1, worth a note.

## Suggested edits on approval

```jsonc
"article_ref": "Art. 9(6)",
"required_data": [
  { "key": "manufacturer.name",    "label": "Manufacturer name, trade name or trade mark" },
  { "key": "manufacturer.address", "label": "Manufacturer postal address" },
  { "key": "manufacturer.contact", "label": "Manufacturer electronic address" }
],
"state": "published", "reviewer": "TR", "last_reviewed_at": "2026-09-13", "confidence": "high"
```

⚠️ Adding a `required_data` entry changes results for every EU SKU — a SKU that was `met` may
become `partial`. That is the correct answer, and it is also why the change belongs in a version
bump with a `catalog_change` record (D-010).

## Sources

- [Regulation (EU) 2023/988, Art. 9(6) — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0988) — quoted passage read 13 Sept 2026.
