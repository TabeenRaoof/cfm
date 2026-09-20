# Review packets

One file per requirement awaiting review. Each sets what the JSON **claims** beside what the
**primary source actually says**, so reviewing is reading two passages and agreeing or
disagreeing — not going and finding the law.

**The division of labour is the point.** An assistant may draft a requirement and assemble the
evidence for it. Only a named human may publish one (`decisions.md` D-008). Nothing in a packet
changes what is live; you do that by editing the JSON and committing, and the exact edit is at
the bottom of each packet.

**Start here: `HOW-TO-PUBLISH.md`.** The steps, the commands, and the four in order.

## How to work through one

1. Open the source link. Confirm the quoted passage is really there and really says that.
2. Decide `confidence`: `high` you have read it and it is unambiguous; `medium` you have read
   it and the mapping to our wording involves judgement; `low` do not publish yet.
3. Edit the JSON: `state` → `published`, `reviewer` → your initials, `last_reviewed_at` →
   today, and on the source you actually read, `verified` → true with `retrieved_at`.
4. Add a row to `../sources.md`.
5. `npm run catalog:check` — it will refuse anything incomplete.

**`medium` is publishable.** The product shows confidence and citation next to every
requirement, so a seller can check you. Holding everything back until it feels lawyer-proof is
how nothing ships.

## Order

Work top down. This is the order that unblocks the most, not the order they were written.

| # | Packet | Why first |
|---|---|---|
| 1 | `eu.gpsr.responsible-economic-operator.md` | The single most-cited obligation; the thing Amazon suppresses listings over |
| 2 | `eu.gpsr.manufacturer-identification.md` | Applies to every EU SKU; no conditions to get wrong |
| 3 | `eu.gpsr.technical-documentation.md` | Applies to every EU SKU; carries the 10-year retention that shapes the product |
| 4 | `de.epr.packaging-lucid.md` | Makes Germany a real market rather than GPSR-only |
| — | `epr-national-schemes.md` | **Wait.** Seven requirements at `confidence: low` on secondary sources. Depth, not credibility — review after the four above are live |

Four published requirements is a credible German scanner. The other fifteen can follow one at a
time, and each one is a thing to post about.
