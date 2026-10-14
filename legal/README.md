# Legal artefacts (D-013, D-053)

The four documents D-013 requires before the first real upload. **All four are drafts** awaiting
legal review; none is in force.

| Artefact | Where | Audience |
|---|---|---|
| Privacy policy | `/privacy` — `apps/web/src/legal/PrivacyPolicy.tsx` | Anyone using the product |
| Customer DPA | `/dpa` — `apps/web/src/legal/Dpa.tsx` | Customer organisations |
| Design partner agreement | [design-partner-agreement.md](design-partner-agreement.md) | Each design partner, signed |
| Deletion procedure | [deletion-procedure.md](deletion-procedure.md) | Internal — the operator |

Supporting records, drafted 8 October 2026 (D-059) — internal, also for legal review:

| Record | Where | Why |
|---|---|---|
| Records of processing activities | [records-of-processing.md](records-of-processing.md) | GDPR / UK GDPR Art. 30 |
| Breach procedure | [breach-procedure.md](breach-procedure.md) | What happens inside the DPA's 48-hour promise |
| DPIA screening | [dpia-screening.md](dpia-screening.md) | Question 7 below, with our view |
| Legitimate interests assessments | [legitimate-interests-assessment.md](legitimate-interests-assessment.md) | Question 4 below, with our view |
| Vendor register | [vendor-register.md](vendor-register.md) | Step 4 below: each DPA, how accepted, copy saved |

The two public pages share their sub-processor list (`subprocessors.ts`) and controller identity
(`identity.ts`, from build-time variables the production build refuses to go without).
`apps/web/test/legal.test.ts` fails if a new database table or sub-processor appears that the
pages do not account for.

## Before `UPLOADS_ENABLED` becomes `"true"`

1. **Apply the erasure migration to the live database** (`supabase db push`, after this is
   merged). `public.erase_organisation` (D-054) is what makes the deletion both pages promise
   possible — see [deletion-procedure.md](deletion-procedure.md#the-audit-log-decision-d-054).
2. **Legal review** of all four, including the questions below.
3. **A sign-in email sender that reaches customers.** Supabase's built-in email delivers only
   to members of the Supabase project's own team, at 2 messages an hour, with no SLA — design
   partners cannot sign in with it. Choose a provider (D-013 names Resend), verify its DPA and
   data location, add it to `senders.ts` and `subprocessors.ts`, then configure it as custom SMTP
   in Supabase.
4. **Vendor DPAs in place.** Supabase and Cloudflare incorporate theirs into their terms, and
   Anthropic's is part of its Commercial Terms — accepted by using each service; keep a dated
   copy of each with the [register](vendor-register.md). The email provider's, once chosen.
5. **A contact mailbox covered by a DPA**, if the reviewer agrees a consumer Gmail address isn't
   ([vendor register](vendor-register.md), "To decide" 2).
6. Set `IN_FORCE = true` and update `LAST_UPDATED` in `identity.ts`; deploy.

Sign-in itself must work first: production's email provider was switched off by D-057 and must be
switched back on (D-058). That blocks *any* account partner, uploads or not.

## Questions for the reviewing lawyer

1. **Representatives (Art. 27 EU GDPR and UK GDPR).** The controller is an individual, not a
   company, resident outside the UK and EU, offering a service to UK and EU businesses and
   processing their documents. Is an EU and a UK representative required, or does the
   "occasional processing" exemption apply?
2. **Customer → processor transfer.** The DPA (§7) incorporates the EU SCCs (module two) and the
   UK addendum by reference for the transfer that results from the operator being outside the
   UK/EU. Is incorporation by reference in a click-through DPA sufficient, and are the module
   options (docking, governing law, supervisory authority) adequately set?
3. **Anthropic retention.** Anthropic may keep inputs flagged for usage-policy violations for up
   to two years. Acceptable for customer documents, or should zero-data-retention be negotiated
   before uploads?
4. **Lawful bases.** Contract for accounts; legitimate interests for invitations and the change
   history. Is a written legitimate-interests assessment needed for either, and is the
   invitation-email role (controller vs processor) right?
5. **Breach notice.** The DPA commits to 48 hours. Realistic for a one-person operator?
6. **Liability, warranty and governing law** — absent from the DPA and marked for you in the
   design partner agreement. There are no general terms of service yet; for design partners the
   signed agreement is the contract the DPA attaches to.
7. **DPIA.** Is a data protection impact assessment needed for automated reading of documents
   containing third parties' business contact details? (Our view: not high-risk — no profiling,
   no decisions about people — but a short screening record may be expected.)
