# Vendor register

**Draft, 8 October 2026 (D-059).** Every provider that processes personal data for CFM, how its
data processing terms were accepted, and where the evidence is. `README.md`'s pre-upload step 4
asks for "a dated copy of each with the register": save each DPA as a PDF with the date you
fetched it, outside this repository, and fill the **Copy saved** column.

Facts below were checked against each vendor's own documentation on **27 September 2026**
(D-053, D-055); re-check before relying on them.

| Vendor | What it does for CFM | Data | Location | DPA and how accepted | Transfer safeguard | Copy saved |
|---|---|---|---|---|---|---|
| Supabase, Inc. | Database, sign-in, sign-in emails (for now) | Accounts, invitations, organisations, products, facts, documents' records and extracted fields, change history | EU — Frankfurt (eu-central-1) | DPA "forms part of" the Terms; accepting them has the same effect as signing the SCCs — nothing to sign | EU SCCs | ☐ |
| Cloudflare, Inc. | Hosting (app and scanner), document file storage (R2), processing queue, scanner waitlist (D1) | Uploaded files; waitlist emails; request data | R2 bucket and D1 in the EU; requests served globally | DPA incorporated into Cloudflare's terms | EU SCCs and UK addendum; 30 days' notice of new sub-processors | ☐ |
| Anthropic, PBC | Reading document fields the rules can't | Document text or file, without account or organisation details | United States; no EU option | DPA part of the Commercial Terms | EU SCCs and UK addendum. Inputs/outputs deleted within 30 days (2 years if flagged for a usage-policy violation); not used for training | ☐ |
| *Sign-in email provider — not chosen* | Delivering sign-in links to customers | Email addresses, sign-in links | — | — | — | — |

## To decide before account partners

1. **The sign-in email provider.** Supabase's built-in email reaches only the project's own team
   (`README.md` step 3). D-013 names Resend. Verify its DPA and data location, add it here and to
   `apps/web/src/legal/senders.ts` and `subprocessors.ts`, then configure custom SMTP.
2. **The contact mailbox.** attestacompliance@gmail.com is the address on both legal pages, so
   data-subject requests, breach notices and partner correspondence go through it. *To confirm:*
   a consumer Gmail account is not, as far as we know, covered by a data processing agreement;
   a mailbox on the product's own domain with a provider that offers one would be. Decide before
   partners send personal data by email.
3. **Outreach platforms** (LinkedIn, Reddit, Facebook groups — D-056) process prospects' data
   under their own terms as controllers. List them here once outreach starts, with what is kept
   off-platform (see `records-of-processing.md` C5).

## Not processors of personal data

GitHub holds the source code and the decisions log — keep partner identities out of the
repository so it stays that way. Paddle, PostHog and Sentry are not used (D-013's "before
charging" list).
