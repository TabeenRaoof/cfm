# Design partner onboarding

**As of 8 October 2026** (D-059). How to go from "no partners" to working with them, in D-056's
three stages. Do §0 first: two of its items break account partners outright.

| Stage | What the partner gets | Ready? |
|---|---|---|
| 1. Feedback partner | A call, and the free scanner run on their own catalogue | **Yes — today.** No account, no paperwork |
| 2. Account partner | Sign-in to the app; products, readiness, technical files; colleagues by invitation. No uploads | **No** — §3's checklist |
| 3. Upload partner | Document uploads and extraction | **Not before OPT** (D-056) |

---

## 0. Morning checklist (about 30 minutes, in order)

**1. Turn email sign-in back on.** Production refuses every sign-in link (D-058). Supabase
dashboard → project `cfm-web` → Authentication → Sign In / Providers → **Email**: turn the
provider **on**. Leave **"Allow new users to sign up" off**. Then check that a stranger is still
refused:

```bash
curl -s -X POST https://qsqhcithnqanqzvsfyez.supabase.co/auth/v1/otp \
  -H "apikey: sb_publishable_1JvNMT7TnLR-I41uX8wjFg_Dz-XoOe1" -H "Content-Type: application/json" \
  -d '{"email":"gate-check@example.invalid","create_user":true}'
```

- `"error_code":"signup_disabled"` — **right**: email works, self-signup is closed.
- `"error_code":"email_provider_disabled"` — still off; step 1 didn't take.
- `{}` — **wrong**: signup is open. Turn "Allow new users to sign up" off.

Then sign out of the app and back in with your own address — the link should arrive.

**2. Merge `legal-docs` into `main`** — 10 commits ahead, all CI steps pass locally. Read the PR.

**3. Deploy.** The live app predates PR #14 — no privacy policy or DPA page — and has none of
D-058/D-059's fixes. From `apps/web` on an up-to-date `main`:

```bash
npm run build          # production: reads .env.production, refuses without the legal identity
npx wrangler deploy
```

Check: `https://compliancefilemanager.com/privacy` shows the policy with its "draft, not yet in
force" banner; the sign-in page shows the Privacy / DPA links at the bottom.

**4. Apply the erasure migration** (D-054). The dry run on 8 October showed exactly one pending:

```bash
npx supabase db push --dry-run --linked   # expect: 20260927000001_erase_organisation.sql
npx supabase db push --linked
```

**5. Rotate two secrets.** The Anthropic API key and the Supabase database password in the root
`.env.local` were printed in a Claude session on 28 September. Rotate both; if the Worker's
`ANTHROPIC_API_KEY` is the same key, update it with `npx wrangler secret put ANTHROPIC_API_KEY`.

---

## 1. Who, and where

**Who (D-033):** UK-established brands selling into the EU through Amazon, Shopify, Etsy or eBay;
20–500 SKUs; 1–10 staff. You're talking to the founder or the one ops person — not a compliance
professional. They usually find out about an obligation when a listing is suppressed.

**Where (D-056):** Reddit (r/FulfillmentByAmazon, r/AmazonSeller, r/Etsy, r/shopify,
r/ecommerce), UK seller Facebook groups, LinkedIn — from your personal accounts, not the
Attesta-named address. Amazon's Seller Forums are read-only research: read the UK forum for the
questions sellers actually ask; don't register as a seller to post.

**How (`01-` §7.2):** answer the question fully; never pitch in the thread. The scanner link
lives in your profile. Message someone only after a useful exchange, and only if their situation
fits the ICP.

## 2. Stage 1 — feedback partners (ready now)

**First message** (adapt; keep it this short):

> Thanks for the back-and-forth on [thread]. I'm building a tool that works out which EU
> compliance requirements apply to each SKU, per market — GPSR, EPR, PPWR. Would you give me 30
> minutes to run it on your own product list and tell me where it's wrong? Your file stays in
> your browser; nothing is uploaded. No sales pitch, and nothing to pay.

**The call — 30 minutes:**

1. *(10 min) Their world* — the Gate 1 questions (`01-` §10):
   - The last time a listing was suppressed, or a marketplace asked for compliance information:
     what happened, how long it took?
   - How do you get documents from suppliers — test reports, declarations of conformity? What's
     missing right now?
   - Who is your EU responsible person? What do you pay for that today?
   - EPR in Germany and France — registered? How did you find out you needed to be?
   - If this went away, what would that be worth to you a month?
2. *(15 min) The scanner, on screen* — they export their catalogue (Amazon inventory report,
   Shopify export, or any sheet), open `https://cfm-scanner.pages.dev`, choose markets and channel,
   and drop the file in. The file never leaves their browser — say so. Ask, row by row: *Is that
   right? Did you know? What would you do about it?* Note every "that's wrong" — a catalog error
   is the most valuable thing you'll hear.
3. *(5 min) Close* — would they try the full app when it's ready (stage 2)? What would make it a
   must-have? Who else should you talk to?

**After the call:** keep notes **outside this repository** under a partner code (`P-001`,
`P-002`…) — `legal/records-of-processing.md` C5 explains why. In the repo, record only the code,
the date, the stage, and anything that changes the product (a catalog error found → fix it with a
citation, as usual). Tally against the gates: Gate 1 wants ≥8 brands ranking "knowing what each
SKU needs" or "getting supplier documents" top-3, at ≥$29/month.

**Reading the scanner's numbers:** read the D1 tally, and subtract 3 for 28 September (D-056).
Never request `/catalog/index.json` to test anything — that's the counter.

## 3. Stage 2 — account partners (not ready yet)

**Every box, before the first account:**

- [ ] §0 steps 1–4 done, and sign-in checked with your own address.
- [ ] **A sign-in email sender that reaches customers.** Supabase's built-in email reaches only
      the project's own team — a partner would never get their link. Choose the provider (D-013
      names Resend), verify its DPA and data location, add it to `apps/web/src/legal/senders.ts`
      and `subprocessors.ts` and the vendor register, configure custom SMTP in Supabase, deploy.
- [ ] **Legal review** of the D-013 four and D-059's five drafts (`legal/README.md`'s seven
      questions); the design partner agreement's liability and governing-law gaps filled.
- [ ] **The contact mailbox** decided (`legal/vendor-register.md`, "To decide" 2).
- [ ] **Your DSO** has confirmed unpaid design-partner testing is fine before OPT (`01-` §9).
- [ ] The partner has **signed** the agreement.

**Then, per partner:**

1. **Record the approval** — `P-00n`, date, stage 2 — in `decisions.md` (D-057). Name and email
   stay in your private notes.
2. **Create their account.** Secret key: Supabase dashboard → Project Settings → API keys.

   ```bash
   SUPABASE_URL=https://qsqhcithnqanqzvsfyez.supabase.co SUPABASE_SECRET_KEY=sb_secret_… \
     npm run -w @cfm/web provision-account -- partner@theirbrand.co.uk
   ```

   Nothing is emailed by the script. (Don't use the dashboard's "Invite user": that account stays
   unconfirmed until the invite link is clicked, and sign-in refuses unconfirmed accounts while
   signup is off — D-058.)
3. **Send the welcome email:**

   > You're set up. Sign in at https://compliancefilemanager.com with exactly this address — you'll
   > get a one-time link (no password). Then:
   > 1. Create your organisation, and say where your business is established.
   > 2. On Readiness, tick the markets you sell into and choose your sales channel.
   > 3. On Products, download the template, fill it from your catalogue (blank = don't know), and
   >    import it. Re-importing later only adds what you fill in; it never erases.
   > 4. Readiness then lists what each SKU needs per market — "Answer these first" shows the
   >    questions that settle the most at once.
   > 5. Add colleagues on Members. They sign in with the address you invite.
   >
   > Document uploads aren't switched on yet. To leave, or to have your data deleted, just reply.

4. **First session, 30 minutes on screen:** their first import, "Answer these first", one technical
   file. Watch where they hesitate; don't help unless they're stuck.
5. **Check-ins:** 15 minutes weekly for four weeks. Ask: what did you use, what was wrong, what
   did you do outside the tool that it should have done?
6. **Leaving:** `legal/deletion-procedure.md` §A (closing the organisation) and §C (their account).
   Monthly: §D (accounts from invitations nobody accepted).

## 4. Stage 3 — uploads (at OPT)

When the EAD's start date arrives (D-046): legal review complete; `IN_FORCE = true` and
`LAST_UPDATED` in `apps/web/src/legal/identity.ts`; measure extraction accuracy on public sample
documents first (D-056); set `UPLOADS_ENABLED = "true"` in `apps/web/wrangler.toml`; deploy. A
founder's price only once billing is lawful.

## 5. Yours to decide

- **Gate 2 vs D-056.** Gate 2 (15 November) wants partners who "upload real documents"; uploads
  stay off until OPT. Move the gate's date, or redefine its upload limb.
- **Gate 1.** Its 15 interviews were due 5 October; none are recorded here.
- **Who may create organisations** (D-058). Today any signed-in user can, so an approved partner
  can bring in anyone. Fine at this scale; tighten if it stops being.
