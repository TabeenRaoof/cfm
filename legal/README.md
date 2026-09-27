# Legal artefacts (D-013, D-053)

The four documents D-013 requires before the first real upload. **All four are drafts** awaiting
legal review; none is in force.

| Artefact | Where | Audience |
|---|---|---|
| Privacy policy | `/privacy` — `apps/web/src/legal/PrivacyPolicy.tsx` | Anyone using the product |
| Customer DPA | `/dpa` — `apps/web/src/legal/Dpa.tsx` | Customer organisations |
| Design partner agreement | [design-partner-agreement.md](design-partner-agreement.md) | Each design partner, signed |
| Deletion procedure | [deletion-procedure.md](deletion-procedure.md) | Internal — the operator |

The two public pages share their sub-processor list (`subprocessors.ts`) and controller identity
(`identity.ts`, from build-time variables the production build refuses to go without).
`apps/web/test/legal.test.ts` fails if a new database table or sub-processor appears that the
pages do not account for.

## Before `UPLOADS_ENABLED` becomes `"true"`

1. **Fix the audit-log erasure blocker** — see
   [deletion-procedure.md § The audit-log blocker](deletion-procedure.md#the-audit-log-blocker).
   Until then, the deletion promised by both pages cannot be carried out.
2. **Legal review** of all four, including the questions below.
3. **A sign-in email sender that reaches customers.** Supabase's built-in email delivers only
   to members of the Supabase project's own team, at 2 messages an hour, with no SLA — design
   partners cannot sign in with it. Choose a provider (D-013 names Resend), verify its DPA and
   data location, add it to `senders.ts` and `subprocessors.ts`, then configure it as custom SMTP
   in Supabase.
4. **Vendor DPAs in place.** Supabase and Cloudflare incorporate theirs into their terms, and
   Anthropic's is part of its Commercial Terms — accepted by using each service; keep a dated
   copy of each with the register. The email provider's, once chosen.
5. Set `IN_FORCE = true` and update `LAST_UPDATED` in `identity.ts`; deploy.

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
