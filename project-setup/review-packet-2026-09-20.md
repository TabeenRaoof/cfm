# Review packet — 4 requirements, 20 September 2026

Per D-008 ("no requirement enters the live catalog without a citation to a primary source, a
retrieval date, a `last_reviewed_at` and a named reviewer") and the capacity-replan's own division
of labour ("packets now exist, so this is reading and signing, not researching") — this batch is
the research; what's left for each is reading the finding below, deciding anything flagged, and
setting `state`, `reviewer` and `last_reviewed_at` on the requirement file yourself. That last step
is deliberately not done here: publishing is D-008's "only a named human" step, not something an
assistant does on your behalf.

Picked because both of Slice B's target document types (`rp_mandate`, `epr_certificate`) depend on
these four, and UK/DE/FR are the markets already exercised in `@cfm/evidence`'s tests.

## 1. `eu.gpsr.responsible-economic-operator` — clean, no changes needed

Fetched Regulation (EU) 2023/988 (GPSR) directly from EUR-Lex. Article 16, "Responsible person for
products placed on the Union market," paragraph 1, matches the requirement's summary and its
`Art. 16` citation exactly. **Nothing to decide — read it and sign off if you agree.**

## 2. `de.epr.packaging-lucid` — clean, no changes needed

Fetched the Verpackungsgesetz (VerpackG) statute text directly. § 9(1) is the LUCID registration
duty, § 7 is the dual-system participation duty ("Systembeteiligungspflicht") — both already cited,
both confirmed to say what the summary says. One thing to know rather than decide: the EU's PPWR
regulation starts reshaping some of these responsibilities from 12 August 2026 per the registry's
own site — doesn't change today's citation, worth a note for the next review cycle.
**Nothing to decide — read it and sign off if you agree.**

## 3. `fr.epr.packaging-citeo` — one citation correction, one structural question

**Correction made:** the draft cited only `Art. L541-10`, which is the *general* EPR principle
applying to every product category subject to extended producer responsibility in France — not
packaging specifically. I found the article that actually brings household packaging into scope
is `L541-10-1`, and the Triman-marking duty this same row also requires evidence for is a
*different* article again, `L541-9-3`. Updated `article_ref` to name both.

**Decision needed:** this one row currently asks for two `required_evidence` entries
(`epr_certificate` for the Citeo contribution, `label_artwork` for Triman) under two different
legal bases. Keep it as one row with two citations (as I've left it), or split it into two rows —
`fr.epr.packaging-citeo` (L541-10-1) and a new `fr.epr.packaging-triman-marking` (L541-9-3) —
matching how every other requirement in the catalog carries exactly one citation. I'd lean split,
for consistency with the rest of the catalog, but it's your call.

**Caveat:** légifrance.gouv.fr's own page blocked a direct fetch (Cloudflare bot-check); the article
text quoted in the requirement's source note came through a search result that itself echoes
Légifrance's page verbatim, not a page I loaded and read myself. Worth a five-minute manual check
in a browser before this one goes live, specifically.

## 4. `uk.epr.packaging-registration` — citation completed, one real modelling gap found

**Correction made:** the draft's own note said "the statutory instrument reference is NOT yet
confirmed." It's now confirmed: **S.I. 2024/1332**, regs. 23-25.

**Finding, not yet fixed:** the regulation itself splits obligated producers into "small producer"
and "large producer" (reg. 23), with materially different duties — small producers register and
report annually; large producers also report every six months, buy recycling notes (PRNs/PERNs),
submit a compliance certificate, and pay a disposal fee. This requirement currently treats every
producer above the threshold the same way, asking for one `epr_certificate`-type evidence item
regardless of tier. That's fine as long as this row means "proof of registration" specifically —
it becomes wrong the moment a large producer's extra duties get modelled, because a small
producer would be told they need evidence for something they don't owe.

**Decision needed:** either (a) explicitly scope this row's summary/title to registration only,
which is common to both tiers, and add the large-producer-only duties as a separate future
requirement when you draft it, or (b) split now into `uk.epr.packaging-registration-small` and
`-large`. I'd pick (a) — it's what the row currently actually tests for — but flagging rather than
silently choosing, since it changes what a customer is told they're compliant with.

**Also noted:** S.I. 2025/1369 amends the 2024 Regulations from 1 January 2026. I checked its
explanatory note; nothing in it touches regs. 23-25 (the parts cited here), but re-check before the
2026 reporting season in case a later amendment does.

---

## What I did not touch

`state`, `reviewer`, `last_reviewed_at` on all four files — those are yours to set. Everything
else (`sources[].verified`, `sources[].retrieved_at`, `article_ref` where a correction was needed,
and a note on every source explaining exactly what was checked and how) is already updated in the
requirement JSON files themselves, so the citation you're signing off on is the current one, not
what's summarised here.
