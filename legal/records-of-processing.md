# Records of processing activities (GDPR / UK GDPR Art. 30)

**Draft, 8 October 2026 (D-059). For legal review with the other D-013 artefacts — not yet
confirmed as complete.** Keep this current: a new table, document type, provider or use of data
means a new or changed row. The privacy policy and DPA must say the same thing.

**Controller:** Tabeen Raoof, operating CFM ("compliance file manager", a working name), an
individual. Contact: attestacompliance@gmail.com. No representative appointed — whether one is
required is lawyer question 1 (`README.md`). No data protection officer (not required at this
scale; confirm in review).

---

## Part 1 — CFM as controller (Art. 30(1))

| # | Activity | Purpose | People | Personal data | Lawful basis | Recipients | Transfers | Retention | Security |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Accounts and sign-in | Letting users in, keeping others out | Users of the app | Email address, organisations and roles, sign-in times | Contract (Art. 6(1)(b)) | Supabase (database, sign-in email) | Operated from outside the UK/EU; SCCs | Until the account or its organisation is closed | See Part 3 |
| C2 | Invitations, including the account created for the invitee (D-058) | Letting an organisation add its own staff | People invited by a customer | Email address, role offered, who invited them | Legitimate interests — [LIA §1](legitimate-interests-assessment.md) | Supabase | As C1 | Invitation: 14 days. Unaccepted account: deleted after expiry (monthly, [deletion procedure §D](deletion-procedure.md)) | See Part 3 |
| C3 | Change history (audit log) | An accurate, tamper-evident record of how a compliance file came to be | Users; anyone named in an organisation's data | Who changed what and when, with before/after copies of the row | Legitimate interests — [LIA §2](legitimate-interests-assessment.md) | Supabase | As C1 | Until the organisation is erased (D-054) | Append-only; readable only by that organisation's owners and admins |
| C4 | Scanner waitlist | Telling people when the product launches | Scanner visitors who join | Email address, optional SKU count | Consent (Art. 6(1)(a)), ticked box | Cloudflare (D1, EU) | Cloudflare can access from outside the EU to operate the service | Until unsubscribe or deletion request, at most 2 years | Unsubscribe link in every email |
| C5 | Design partner outreach and correspondence | Finding and working with design partners (D-056) | Prospective and actual partners | Name, business, work email or social profile, notes of calls | Legitimate interests (B2B outreach) — *reviewer to confirm; LIA not yet written* | Email and social platforms used for outreach (see [vendor register](vendor-register.md)) | Varies by platform | Delete notes of anyone who declines within 3 months; partners: for the agreement's life plus 1 year — *reviewer to confirm* | Keep outside the repository (see below) |

Not personal data, recorded for completeness: the scanner's usage tally stores only a date and
which markets were checked (D-043, D-056).

**Partner identities do not go in this repository.** The decisions log and onboarding notes are
on GitHub; recording a partner's name or email there would make GitHub a processor and put the
data in every clone. Use a partner code (`P-001`) in the repo and keep the key privately.

## Part 2 — CFM as processor for its customers (Art. 30(2))

**Controllers:** each customer organisation (owner contact in the app). One record for all of
them, since every customer gets the same processing under the same [DPA](https://compliancefilemanager.com/dpa).

| Item | Entry |
|---|---|
| Categories of processing | Storing products, compliance facts and uploaded documents; reading documents (rules first, then the AI provider for remaining fields); evaluating them against the requirement catalog; generating technical files |
| Personal data | Names, addresses, emails and registration numbers of people named in documents and facts — responsible persons, signatories, suppliers' contacts |
| Sub-processors | Supabase (EU, Frankfurt), Cloudflare (files in the EU jurisdiction), Anthropic (US) — DPA §6 and [vendor register](vendor-register.md) |
| Transfers | To Anthropic in the US, and by the operator's access from outside the UK/EU — EU SCCs (module 2) and the UK addendum, DPA §7 |
| Security | DPA §5 and Part 3 |
| Retention | Until the customer deletes it or closes its organisation; erasure within 30 days of a closure request (DPA §8, [deletion procedure](deletion-procedure.md)) |

**Uploads are off** (`UPLOADS_ENABLED=false`) until D-013 is complete, so Part 2's document rows
describe the service as designed, not data held today.

## Part 3 — Security measures (Art. 32), summary

Tenant isolation by row-level security, tested against the real migrations on every CI run;
TLS in transit and encryption at rest; data at rest in the EU; passwordless sign-in by
single-use link; roles within each organisation; server credentials only on the server, with a
build that refuses to ship one to browsers; an append-only change history; documents sent to the
AI provider only when rules can't read them, without account or organisation details. Gaps
stated plainly: no automatic backups on Supabase's free plan; a single operator with full access.
