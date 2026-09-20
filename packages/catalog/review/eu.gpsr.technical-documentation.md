# Review · `eu.gpsr.technical-documentation`

**Researched 13 September 2026.**

## What our JSON claims

> **Article:** Art. 9(2), Annex · **Applies when:** market is in the EU
> **Needs:** a `risk_assessment` and a `technical_file` · **Confidence:** high

## What the source says

Read directly from the EUR-Lex text:

> **Article 9(2):** manufacturers must "draw up technical documentation containing at least a
> general description of the product" and "an analysis of the possible risks related to the
> product and the solutions adopted to eliminate or mitigate such risks."

> **Article 9(3):** documentation kept "for a period of **10 years** after the product has been
> placed on the market."

## Assessment

✅ **Confirmed, and the ten-year retention is explicit in the text.** Three notes:

1. ❗ **Cite Art. 9(2) and 9(3) together.** The retention period is the half that shapes our
   product — it is why storage and export are designed around a decade — and it currently has
   no citation of its own.
2. ❓ **Is "Annex" right?** Our `article_ref` appends it. Confirm which annex, or drop it. An
   imprecise citation next to a precise one reads worse than no citation.
3. ✅ **Splitting into two evidence types (`risk_assessment`, `technical_file`) is our
   judgement, not the law's** — the regulation describes one documentation set containing a
   risk analysis. Defensible for workflow reasons: the risk analysis is what sellers are
   missing, so naming it separately makes the gap legible. Worth a comment in the JSON.

**Retention is a seller duty, not ours** — see D-006. The ten years belongs in what the product
*tells* the customer, not in how long we hold their files after they cancel.

## Suggested edits on approval

```jsonc
"article_ref": "Art. 9(2) (technical documentation incl. risk analysis); Art. 9(3) (10-year retention)",
"state": "published", "reviewer": "TR", "last_reviewed_at": "2026-09-13", "confidence": "high"
```

## Sources

- [Regulation (EU) 2023/988, Art. 9(2)–(3) — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0988) — both passages read 13 Sept 2026.
