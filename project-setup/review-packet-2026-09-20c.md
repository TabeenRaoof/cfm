# Catalog review packet 3 — general-goods breadth (DSA, GPSR distance selling, UK importer marking, PPWR)

**Date:** 2026-09-20
**Batch:** 5 requirements (one more than the usual 4 — the two PPWR rows share one statute and were
cheaper to research together)
**Prioritisation:** Per [D-034](decisions.md#d-034), still general-goods breadth over category depth.
This batch clears the general-goods DSA/GPSR/PPWR rows that packets 1-2 didn't reach, plus one UK
row (`uk.importer.identification`) whose citation was a placeholder ("sector regulations;
unconfirmed") rather than a wrong citation.

For each row below: what I found, against which primary source, and what — if anything — still
needs your call. As with packets 1-2, I only touched `sources`, `article_ref`/`regulation` text
where the citation itself needed correcting, and `summary` where the old wording no longer matched
what the statute actually says. `state`, `reviewer`, and `last_reviewed_at` are untouched — that's
your sign-off, not mine.

---

## 1. `eu.dsa.trader-information` — clean, ready to sign off

**What it claims:** A marketplace must obtain and verify a trader's identity, contact details,
payment account, trade register entry and a compliance self-certification before letting them
sell.

**Checked against:** [Regulation (EU) 2022/2065 (DSA), Art. 30](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng),
fetched in full.

**Finding:** Matches point for point. Art. 30(1) lists the five items (name/address/phone/email;
ID document or eID; payment account details; trade register + number where applicable;
self-certification); Art. 30(2) requires best-efforts verification of all five against official
databases or supporting documents. No citation change needed.

**Recommendation:** Publish as-is.

---

## 2. `eu.gpsr.distance-selling-information` — clean, ready to sign off

**What it claims:** A distance-sale listing must show the manufacturer's identity/contact, the
responsible person (if the manufacturer isn't EU-established), product identification, and
warnings/safety info.

**Checked against:** [Regulation (EU) 2023/988 (GPSR), Art. 19](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32023R0988),
fetched in full (Publications Office PDF).

**Finding:** Matches point for point, including the cross-reference to Art. 16(1) of the same
Regulation for the responsible person — exactly the `rp.name` field this row already models. No
citation change needed.

**Recommendation:** Publish as-is.

---

## 3. `uk.importer.identification` — citation upgraded from placeholder to real statute

**What it claimed before:** `article_ref: "Sector regulations; unconfirmed"` — an honest
placeholder, not a wrong citation, but not sign-off-ready either.

**Checked against:** [The General Product Safety Regulations 2005, reg. 7](https://www.legislation.gov.uk/uksi/2005/1803/regulation/7),
fetched directly — the same instrument as `uk.gpsr.general-safety-requirement` (reg. 5), published
in packet 2.

**Finding:** Reg. 7(2) defines "producer" to include the importer where the manufacturer isn't UK
(or EU/EEA — see the "relevant state" definition) established and there's no UK representative.
Reg. 7(3) requires that producer to adopt measures to stay informed of and act on product risks;
reg. 7(4) lists what those measures include, and (a) is the marking duty this row models: name,
address, and product/batch reference, "except where it is not reasonable to do so." So this isn't
a separate importer-only regime as the placeholder implied — it's the same statute's next
regulation over from the general safety requirement.

**Changes made:**
- `regulation`: "UK product safety regime (importer identification)" → "General Product Safety
  Regulations 2005 (SI 2005/1803)"
- `article_ref`: "Sector regulations; unconfirmed" → "reg. 7(3)-(4)(a)"
- `summary`: reworded to state the actual mechanism (importer treated as producer, reasonableness
  qualifier, transitional batch-marking carve-out to 31 Dec 2027) instead of "the exact obligation
  varies by product regime"
- `confidence`: low → medium

**Recommendation:** Ready to sign off, same shape as the packet-2 GPSR rows.

---

## 4. `eu.ppwr.producer-registration` — citation confirmed, one timing risk flagged

**What it claims:** A producer must be registered in each Member State's packaging-producer
register before supplying packaged goods there.

**Checked against:** [Regulation (EU) 2025/40 (PPWR), Art. 44](https://eur-lex.europa.eu/eli/reg/2025/40/oj),
fetched in full.

**Finding:** Art. 44, "Register of producers," matches: para 2 requires registration in each
Member State of first supply; para 4 bars supplying there unregistered. Citation confirmed correct.

**Timing risk, not a citation problem:** Art. 44(1) ties each Member State's actual register to
"18 months of the date of entry into force of the first implementing act" under para 14, and that
implementing act — due 12 February 2026 per the Regulation itself — was still not adopted as of an
industry tracker (EUROPEN) checked the same day as this review. So the legal duty starts on
PPWR's general-application date (this row's `effective_from`), but the register a producer would
actually register *in* may not exist in most Member States for a while past that. I didn't change
`effective_from` — the law's obligation date and the practical registration date are genuinely
different things, and only the former is what this row's date field is supposed to capture — but
flagging it so it isn't mistaken for "should be enforceable and isn't" if a customer asks in Q1
2027.

**Recommendation:** Ready to sign off on the citation. Worth a standing note to re-check
implementing-act status each review cycle (added to `progress-log.md`).

---

## 5. `eu.ppwr.authorised-representative` — citation tightened; scoping question for you

**What it claimed before:** `article_ref: "Art. 45"` — the whole article.

**Checked against:** [Regulation (EU) 2025/40 (PPWR), Art. 45](https://eur-lex.europa.eu/eli/reg/2025/40/oj),
fetched in full.

**Finding:** Art. 45 as a whole is titled "Extended producer responsibility" and is mostly about
financial contributions (para 2) and marketplace/fulfilment-provider duties (paras 4-9). The
authorised-representative appointment duty this row models is specifically **para 3**: *"A producer
referred to in Article 3(1), point (15)(c) and (d), shall appoint, by written mandate, an
authorised representative for the extended producer responsibility in each Member State where the
producer makes packaging or packaged products available for the first time, other than the Member
State where the producer is established."*

**Change made:** `article_ref`: "Art. 45" → "Art. 45(3)" — same kind of tightening as packet 2's
`eu.gpsr.manufacturer-identification` (Art. 9 → Art. 9(6)).

**Scoping question I didn't resolve:** Art. 45(3)'s mandatory duty is narrower than what this row
currently checks (`organisation.established_in_market: false`, i.e. "not established here"). The
statute keys it to the producer definitions at Art. 3(1)(15)(c) and (d) specifically — per a
secondary summary I checked but did not verify against the Annex/definitions article directly,
those are producers selling packaging or packaged products cross-border directly to end users, a
narrower group than "any non-established producer." Art. 45(3)'s second subparagraph also leaves it
to each Member State's discretion whether to additionally require one from other third-country
producers. I did not touch `applies_when` — narrowing it without reading Art. 3(1)(15)(c)/(d)
directly risks guessing at a definition, which is exactly what packet 1's French EPR split and
packet 2's UK responsible-person finding were both trying to avoid. Options, same shape as before:

- **(a)** Hold `applies_when` as-is (broader than the strict statutory trigger — errs toward asking
  for an AR more often than legally required, which is a safe direction to err in for a compliance
  tool) and sign off on the citation only.
- **(b)** I read Art. 3(1)(15) directly next session and rewrite `applies_when` to key off the
  actual producer-type distinction before you sign off.

**Recommendation:** Citation is solid either way. Pick (a) or (b) for the scoping.

---

## Summary for your review

| Requirement | Citation status | Recommendation |
|---|---|---|
| `eu.dsa.trader-information` | Confirmed, unchanged | Sign off |
| `eu.gpsr.distance-selling-information` | Confirmed, unchanged | Sign off |
| `uk.importer.identification` | Upgraded from placeholder to real statute | Sign off |
| `eu.ppwr.producer-registration` | Confirmed; timing risk flagged (not a citation fix) | Sign off |
| `eu.ppwr.authorised-representative` | Tightened Art. 45 → Art. 45(3) | Sign off citation; choose (a) hold or (b) rescope for `applies_when` |
