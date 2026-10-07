# Product Compliance File Manager for Small Physical-Goods Brands
## Business Viability Report — v1, 7 September 2026

Prepared for: Tabeen Raoof (solo founder, F-1 → OPT from 12 Dec 2026)
Companion document: `02-technical-plan-product-compliance-file-manager.md`

---

## 0. Executive verdict (read this first)

**Verdict: conditionally viable — but not in the form we first described.**

The demand side is real and getting worse for sellers, which is good for you. GPSR has been enforced since December 2024 and Amazon suppresses non-compliant EU listings within about 48 hours of detection; bol.com began pulling non-compliant products in April 2026; and the EU packaging regulation (PPWR) has applied since 12 August 2026 with no grace period — non-EU sellers must register in every EU country where they sell, appoint an authorised representative in each, and pay annual packaging fees, with marketplaces now verifying registrations. The Commission's 2025 Safety Gate results show record alerts and a 35% rise in enforcement actions.

The supply side is the problem. This is **not a quiet niche**. It is a 2025–2026 gold rush with five distinct competitor groups (Section 3), including AI-native platforms with knowledge graphs and document generation, and a dozen Responsible-Person bureaus that bundle "document storage" for €199–249/year. The horizontal product — "a place to store your compliance documents" — is already commoditised. **If you build the horizontal file manager, you will lose.**

What is still open, and where a solo founder can win:

> **The wedge:** a self-serve tool for brands with ~20–500 SKUs that (1) tells them exactly what evidence each SKU needs per market and channel, (2) collects and *verifies* that evidence from suppliers, (3) keeps the per-SKU file audit-ready across EU/UK (US later), (4) pushes the right data into each marketplace's template, and (5) re-evaluates the whole catalog when rules change. Sold at $29–199/month, distributed through seller communities and *through* the RP bureaus rather than against them.

Three things this report corrects from our earlier discussion:

1. **Your ideal customer is not a US brand.** Fewer than 1% of US Amazon sellers sell outside North America. The real base is UK sellers (post-Brexit, ~280K active), EU sellers selling cross-border inside the EU, and — large but hard to reach — Chinese sellers.
2. **Storage is not the product.** RP bureaus legally hold the technical file and already bundle storage. Your value is workflow, verification, multi-channel sync and change management.
3. **Defensibility comes from the rule catalog + integrations + workflow, not from AI.** The LLM is a replaceable component (Section 4).

**Honest probability:** for a solo founder with ~5 hrs/week until December and more after, executing the wedge well, I put the chance of reaching $3–5K MRR within 24 months at roughly 25–35%. That is a judgement, not a measurement; it is typical for micro-SaaS, and the three validation gates in Section 10 are designed to find out cheaply whether you're in the good part of that distribution before you spend real time.

---

## 1. Customer and problem

### 1.1 Ideal customer profile (ICP), in priority order

| Priority | Segment | Why | Reachability |
|---|---|---|---|
| 1 | **UK-established brands selling into the EU** (Amazon, Shopify, Etsy, eBay), 20–500 SKUs, 1–10 staff | Post-Brexit they are "non-EU" for every EU obligation; English-speaking; large base (~281K active UK Amazon sellers); many already pay bureaus | High — UK seller Facebook groups, Amazon Seller Forums, UK podcasts/YouTube |
| 2 | **EU-established brands selling cross-border within the EU** | PPWR Art. 44/45 create per-member-state registration and representative duties where they are not established; EPR schemes differ per country | Medium — German/Dutch/French communities; language barrier for content |
| 3 | **Amazon agencies and consultants managing 5–30 brands** | One buyer, many SKUs; they need a client-facing system; they churn less | Medium — LinkedIn outbound, agency directories |
| 4 | **US/Canadian brands entering the EU** | Your original assumption; small segment but high willingness to pay because everything is new to them | High (communities you know) but small |
| 5 | Chinese sellers | Largest non-EU group by far; language, payment and trust barriers | Low directly; possible via bureaus who serve them |

Persona: the founder or the one "ops" person. They are not compliance professionals. They discover obligations when a listing is suppressed.

### 1.2 Jobs the customer needs done

1. Know which obligations apply to *this SKU* in *this market* on *this channel* (GPSR baseline; CE directives for electrical/toys/PPE; EPR packaging per country; WEEE/batteries; PPWR producer duties; DSA trader information; UK divergences).
2. Get the documents from suppliers (test reports, Declarations of Conformity, material declarations) — the most painful step for private-label sellers sourcing from Alibaba.
3. Know whether those documents are real and applicable (right standard version, right product, accredited lab).
4. Keep a technical file that can be produced to an authority on short notice and retained for 10 years.
5. Enter the right data in each channel's compliance fields (Amazon Manage Your Compliance, bol.com, Shopify, Etsy, eBay) and keep them in sync when the RP or manufacturer changes.
6. Register and report EPR per country and keep registration numbers current in each channel.
7. Get label/packaging text right per market (RP name and address, warnings in local language, Triman/Info-tri in France, etc.).
8. React when rules change or a listing is suppressed.

Today these jobs are done with a shared drive, a spreadsheet, a bureau for the RP appointment, and panic.

### 1.3 Evidence the pain is real and enforced

- Amazon suppresses EU listings without an RP within roughly 48 hours; new ASIN creation has required compliance data upfront since Q2 2026.
- bol.com has removed non-compliant products since April 2026; a seller with 500+ SKUs cannot check every product manually.
- From 12 August 2026 Amazon verifies packaging EPR numbers for every EU country where a seller distributes, not just DE/FR/ES.
- GPSR requires a documented risk analysis and technical file per product, an EU responsible person on every product and listing, and a functioning recall process.
- Even the compliance guides written for sellers say a full review must check GPSR, batteries, packaging and country EPR together, because a product can pass GPSR and still be blocked by unrelated paperwork.

---

## 2. Market size (bottom-up; every number below is an assumption to validate)

**Top of funnel.** Amazon had roughly 1.65M active sellers worldwide at the end of 2025, down from ~2.4M in 2021 ("the Great Compression"). Country estimates vary by definition: UK ~281K, Germany ~151–244K, Italy ~217K, France ~212K. Fewer sellers, but more professional ones with more revenue each — which is the buyer you want.

**Serviceable market (SAM) — assumption chain:**

| Segment | Base | Assumed share selling cross-border into ≥1 EU country with ≥20 SKUs | SAM accounts |
|---|---|---|---|
| UK sellers | ~281K | 15–25% | 40–70K |
| EU cross-border sellers (DE/FR/IT/ES/NL) | ~800K+ combined | 10% | 80K |
| US/CA into EU | ~1.1M US | <1% | ~8–10K |
| Shopify/Etsy-only into EU | unknown | — | tens of thousands |

Call it **100–200K accounts** that plausibly need a multi-market compliance workflow. You do not need a large share: **0.1% = 100–200 customers = $5–15K MRR** at a $50–75 blended price. That is the entire business case: a tiny slice of a large, forced-to-buy population.

**Spend anchors (what they already pay, per year):** RP service €199–800 (Eldris: £195 one-time + from £9.95/month by SKU count; Fluxy: from €249/yr including document storage and labels, bundles from €999/yr; EaseCert: one-time fee by category). EPR: Germany LUCID + dual system from €39–99; France ~€100–300; Italy similar; electronics via a provider €860–1,200 per category. Testing €200–1,000 per product. A seller therefore already spends **€500–3,000/year** on compliance. A $29–79/month tool must be justified by hours saved and delisting avoided, and priced by SKU count so the small seller pays little and the 300-SKU brand pays properly.

---

## 3. Competitive landscape and risk

### 3.1 The five competitor groups

| Group | Who | What they do | Risk to you | How you handle it |
|---|---|---|---|---|
| **A. Marketplaces** | Amazon Manage Your Compliance (MYC) dashboard; bol.com; Shopify/Etsy fields | Collect the data; flag ASINs; bulk CSV upload | **High** if Amazon adds document storage/workflow. Amazon historically demands data rather than managing sellers' files, but it can move. | Be multi-channel; own the *supplier* and *verification* workflow that happens before listing; export into MYC rather than replace it |
| **B. AI compliance platforms (mid-market/enterprise)** | Reglyr (unified regulatory knowledge graph; upload a SKU + markets → GO/FIX/REVIEW verdicts, generated DoCs, technical files, risk assessments, labels in 40+ languages; targets enterprise retailers, mid-market CPG, consultancies), Complir (AI agents, contact-sales), Certivo (PPWR starter package) | The full "compliance brain" | **Medium.** They are sales-led and integrate with PIM/PLM/ERP; a 30-SKU Shopify seller is unprofitable for them. Risk is a self-serve tier. | Speed, price, marketplace-native UX, no sales calls. Watch them quarterly. If one launches self-serve at <$100/month, that is a kill signal (Section 10). |
| **C. PPWR/EPR platforms** | PPWR Connect (single packaging dataset, Art. 6 recyclability grading, DoCs), EcoComply.ai, Coolset, Tracex | Packaging data and EPR reporting | **Medium** on the packaging module only | Product safety + packaging in one place for small sellers; partner or integrate later |
| **D. RP/AR service bureaus** | Eldris, EaseCert, Fluxy.One, eugpsr.eu, EAS, Complico (free DoC and risk-assessment generators), Lappa, VATAi, GetEUReady, dozens more | Appoint the legal RP/AR, hold the technical file, sometimes generate labels | **Medium-low as competitors, high value as partners.** Most are service shops with basic portals. | Make your product their client-facing workflow: referral fees, white-label/agency tier. Never sell the RP role yourself (you cannot — it must be EU-established). |
| **E. Seller tools** | Assortiqo (free GPSR CSV scanner, up to 50 products, paid API integrations coming), M2E Cloud (auto-submits GPSR data at listing), Helium 10 / Jungle Scout (could add a module) | Listing-field scanning and data entry | **High on the "scan for missing fields" feature** — it is table stakes now | Go deeper than listing fields: documents, suppliers, verification, multi-market, change management. Treat the scanner as a free lead magnet, not the product. |
| **E′. Euverify — re-assessed 8 October 2026 (D-061), moved out of Group E** | Checked against euverify.com/ppwr and /pricing: Starter £490/yr (~$52/mo) bundles GPSR + PPWR + DoC/technical-file generation + **the EU or UK AR/RP role itself** (and GDPR Art. 27 separately); also CE/UKCA, toys, machinery, PPE, cosmetics, medical device add-ons. "Product family" counted, not SKU; CSV import at Scale (£1,490/yr); no visible AI extraction from uploaded documents, no per-country EPR registration tracking (LUCID/Citeo/CONAI-style), no Amazon-native exports. | **Medium-high — touches the standing kill signal below directly:** self-serve, under $100/month, bundling the compliance brain *and* the legal role in one, the combination Groups B and D were kept separate to avoid. | Not research alone — found reaching the ICP's exact channel. **For Tabeen to judge against Section 10's kill signal, not decided here.** What still holds: no document-reading AI, no per-country EPR granularity, no Amazon-native workflow, no category restraint (D-034). |
| **F. Free generators and general LLMs** | Complico's free generators; ChatGPT/Claude/Gemini | Explain rules, draft DoCs, extract fields | See Section 4 | Design for the jobs an LLM chat cannot do |
| **G. Recall / Safety Gate monitoring tools** | SafeCart (checked 8 Oct 2026: monitors SKUs against the EU Safety Gate/RAPEX database, bulk RP assignment, GPSR support as alerting rather than a full requirement engine; no EPR, no PPWR, no technical file, EU-only with no per-market split; Free up to 100 products, Pro €29/mo up to 1,000) | Ongoing recall/alert surveillance against Safety Gate, with GPSR bolted on | **Low today** — no overlap on EPR/PPWR, multi-market tracking or document evidence, which is CFM's core. Same price point (€29) and "software tool, not your RP" stance, so watch if it adds EPR/PPWR. | Found via a founder answering GPSR questions in r/FulfillmentByAmazon — the exact motion D-025/§7.2 prescribes, working. Not a target for partnership (same ICP, same channel) or imitation (recall monitoring is a different job); watch quarterly, same as Group B. |

### 3.2 What this means

- **Horizontal "compliance platform" positioning is taken** by Group B; **"document storage" is bundled** by Group D; **"listing scanner" is free** from Group E.
- **Open:** the small-brand *operating workflow* — supplier collection → verification → per-SKU readiness across markets → channel sync → change alerts — priced for 20–500 SKUs, with bureaus as channel.
- **The single biggest structural risk is Amazon.** Mitigate by never being Amazon-only and by owning the pre-listing (supplier) side, which Amazon has no reason to build.

---

## 4. "Why can't they just use Claude or ChatGPT?" — the defensibility test

Be honest about what a general LLM already does well, because your customers will try it first:

- Explain what GPSR/EPR/PPWR require (well).
- Extract fields from a test report or DoC you paste in (well).
- Draft a Declaration of Conformity or a risk-assessment narrative (adequately; often wrong on specifics).
- Translate warnings (well, with review).

What it does not do — and what the product must be built around:

| Job | Why chat fails | What the product does |
|---|---|---|
| Persistent state | Chat has no per-SKU, per-market, per-channel state that survives months | System of record: every SKU × market × requirement has a status, evidence links and history |
| Determinism | LLM answers vary and cannot be audited | A versioned, human-reviewed requirement catalog; the LLM never decides *what applies*, only reads documents |
| Time | No expiries, deadlines or reminders | Expiry tracking (test reports, RP mandates, EPR renewals), reporting calendars, alerts |
| Change | Doesn't know a rule changed last week, cannot re-check 300 SKUs | Catalog updates trigger re-evaluation across the catalog; change notes go to affected customers |
| Suppliers | Cannot chase a factory in Shenzhen for a missing report | Supplier request links, reminders, upload portal, bilingual templates |
| Verification | Will believe a fake PDF | Accreditation lookups, standard-version currency checks, report-to-product match, tamper heuristics |
| Channels | Cannot produce Amazon's exact bulk template or Shopify metafields | Export/sync in each channel's schema |
| Evidence | No audit trail, no 10-year retention, no authority-ready package | Immutable audit log, one-click technical file package, shareable RP/authority link |
| Teams | Single user | Multi-user, agency multi-client |

**The honest caveat:** LLM products are adding files, memory and agents. For a hobbyist with 5 SKUs, a folder plus ChatGPT will be good enough forever — do not build for that customer. Defensibility grows with SKU count, markets, channels and team size. Price and position for 20+ SKU brands and agencies.

**Design principle that follows:** the model is a commodity input. The build uses a provider-agnostic AI layer with an open-weight fallback so no vendor's price change can kill the business (see technical plan §3 and §6).

---

## 5. Product definition

### 5.1 v1 — the wedge (12 weeks to MVP; usable by design partners, paid from 12 Dec 2026)

1. **Catalog import**: CSV (Amazon inventory report, Shopify export, plain sheet). SKU, category, materials, power/battery flags, markets sold, channels.
2. **Requirement engine**: for each SKU × market × channel, the list of required data and evidence. Scope at launch: GPSR core; DSA trader info; EPR packaging for DE, FR, ES, IT, NL, AT; PPWR producer duties (registration per state, authorised representative, packaging DoC); flags for CE-directive categories (electrical, toys, PPE, RED) and for WEEE/batteries; UK divergences flagged.
3. **Evidence vault with AI extraction**: upload test reports, DoCs, material declarations, RP mandates, EPR certificates → classified, fields extracted, linked to SKUs → readiness score and gap list per SKU and per market.
4. **Supplier requests**: generate a request (EN + ZH template) with a magic upload link; reminders; status.
5. **Expiry and deadline tracking**: report dates, RP mandate terms, EPR renewals, reporting calendar.
6. **Channel exports**: Amazon MYC bulk template; Shopify metafield CSV; bol.com fields; a printable "technical file" PDF per SKU.
7. **Free scanner** (lead magnet): upload a CSV, see which SKUs are missing what for one market.

### 5.2 v2 (months 4–9)

Amazon SP-API sync (pull catalog, flag missing attributes, detect suppressions); Shopify app; Etsy/eBay field exports; **test-report verification** (accreditation lookup, standard-version currency, report-to-product match, tamper signals); label-text generator per market with RP details; DoC and risk-assessment drafts from extracted data; **PPWR packaging data capture** and EPR reporting calendar; **agency tier** (multi-client).

### 5.3 v3 (months 9–24) — the adjacencies that get you to and past $3–5K/month

| Adjacency | Revenue model | Why it fits |
|---|---|---|
| Productised compliance audits ("we review 25 SKUs, you get a gap report") | $99–299 per batch, done by you with your own tool | Fast cash from the same customers; you learn what to automate next |
| Referral fees from RP bureaus and test labs | 10–20% of referred contract | You are the front door; they need clients |
| Agency / white-label tier for bureaus and consultants | $199–499/month | One customer, thirty brands |
| US module (CPSIA/CPC for children's products, Prop 65, FCC, FDA cosmetics) | Higher tier | Same customers sell in the US |
| Digital Product Passport readiness (batteries 2027; textiles later) | Add-on | Next forcing function |
| Regulatory-change monitoring as a paid newsletter/feed | $9–19/month | Low touch; also your marketing engine |
| EPR reporting filing service (partner-delivered) | Rev-share | Recurring, annual |

---

## 6. Pricing and unit economics

**Tiers (by SKU count, because that is what scales the pain):**

| Tier | Price | Limits | Target |
|---|---|---|---|
| Free | $0 | 3 SKUs, 1 market, scanner + checklist | Lead magnet, forum CTA |
| Starter | $29/mo | 25 SKUs, 3 markets, vault, exports | Small brands |
| Growth | $79/mo | 150 SKUs, all EU + UK, supplier portal, verification, alerts | Core customer |
| Scale | $149/mo | 500 SKUs, API sync, priority support | Larger brands |
| Agency | $199–299/mo | Multi-client, white-label | Bureaus, consultants |

Annual = 10 months' price. Bill in USD or EUR via a merchant-of-record so EU VAT is not your problem (technical plan §3).

**Cost of goods:** AI extraction for one SKU with three documents costs roughly $0.05–0.20 one-time at current Claude Sonnet 5 / Haiku 4.5 prices (worked example in the technical plan §6.5); ongoing per-customer AI cost is under $1–3/month. Storage and email are cents. **Gross margin >85%.**

**Paths to $3–5K MRR:**

- 70 Starter + 25 Growth ≈ $4.0K
- 40 Growth + 5 Agency ≈ $4.2K
- 25 Growth + 10 audits/month at $150 ≈ $3.5K (services bridge while SaaS grows)

**The real constraint is churn, not price.** Amazon seller churn runs roughly 20–25% a year among active accounts and higher among small ones. Assume 4–6% monthly churn early; at $4K MRR you need 6–10 new customers every month just to stand still. Distribution has to be a machine, not a launch.

---

## 7. Go-to-market

### 7.1 Positioning

> "The compliance file for every SKU you sell in Europe — know what's missing, get it from your supplier, prove it to Amazon and the authorities. From $29/month. Works with your RP."

Not "AI compliance platform" (Group B owns that). Not "we are your Responsible Person" (you legally cannot be). You are the seller's *file* and *workflow*; the bureau is the seller's *legal representative*; Amazon is the *enforcer*. Say this explicitly on the homepage — it tells bureaus you are a partner, not a threat.

### 7.2 Distribution channels, ranked by cost and fit

1. **Communities (free, highest fit).** r/FulfillmentByAmazon, r/AmazonSeller, r/Etsy, r/shopify, r/ecommerce; UK seller Facebook groups; Amazon Seller Forums (the GPSR/EPR/PPWR threads are permanent); Shopify Community; Etsy forums. Rule: answer the question fully, link the free scanner in profile, never pitch in-thread. Target: 5 substantive answers/week. This is where your Yardi support instinct is an unfair advantage.
2. **Free tools as lead magnets.** The CSV scanner; an "EU obligations by country" checklist generator; a PPWR "do I need a representative in this country?" calculator. Assortiqo and others already do a GPSR scan — yours must be multi-market and include packaging/PPWR to be worth clicking.
3. **SEO content (intern-friendly).** The search results in this research are dominated by bureaus' blogs — that is who you are competing with for "EPR Spain Amazon 2026", "PPWR checklist Etsy", "GPSR toys documentation". Programmatic pages: market × category × channel. Publish a monthly regulatory-change digest — it is also product content.
4. **Partnerships (the multiplier).** RP/AR bureaus (Eldris, EaseCert, Fluxy, eugpsr.eu, EAS, Complico, Lappa…): offer a referral fee and a free agency seat; they get a better client experience, you get distribution. Also: EU/UK 3PLs and prep centres, sourcing agents, Amazon agencies, VAT/EPR firms that already sell EU bundles (VATAi, hellotax, SimplyVAT-type firms). Target: 3 signed referral partners by month 6.
5. **Provider directories.** Apply to Amazon's Service Provider Network (verify current requirements); Shopify App Store once the app exists.
6. **Podcasts / YouTube.** Guest on UK and EU seller shows; short explainer videos on each new enforcement wave.
7. **Paid.** Only after product-market fit: seller newsletter sponsorships ($200–1,000 per placement) and retargeting. No paid search — bureaus outbid you.

### 7.3 Sales plan

- **Self-serve for Free/Starter**; **human onboarding call for Growth and above** — 30 minutes, you drive, you learn. Do this for the first 50 customers personally; it is your best research and your best retention lever.
- **Outbound to agencies**: 20 personalised LinkedIn messages/week to Amazon agencies and consultants in UK/DE/NL; offer a free agency pilot for one client.
- **Design partners**: 10 free accounts (Sept–Dec, while you cannot charge), converting to paid on 12 December with a founder's discount. Their logos and quotes become the launch.
- **Weekly office hours** (open Zoom, one hour) — cheap, builds community, generates content.
- **Annual prepay** push at month 6 for cash and churn reduction.

### 7.4 Funnel targets (assumptions, to be replaced by data)

| Milestone | Target | Assumption |
|---|---|---|
| By 5 Oct 2026 | 15 discovery interviews; 100 waitlist | Community engagement + landing page |
| By 15 Nov | 150 scanner uses; 10 design partners active | Free tool converts 5–10% to design partner |
| 12 Dec (OPT start) | Charging enabled; 8–12 paying | 50–70% of design partners convert |
| Month 6 (Jun 2027) | 30–45 paying; 2–3 referral partners | 6–10 new/month; 5% churn |
| Month 12 | 60–90 paying (~$3–5K MRR) | Partners deliver 30% of new customers |
| Month 24 | 150–200 paying + agency + services ($8–15K MRR) | v3 adjacencies live |

Metrics to track from day one: scanner → signup rate; signup → paid; time-to-first-value (first SKU fully green); monthly churn; partner-sourced share; support tickets per customer.

---

## 8. Budget

### 8.1 Initial development (months 1–3, Sept–Dec 2026)

| Item | Monthly | 3-month total | Notes |
|---|---|---|---|
| AI coding tool (Claude Code Pro or Cursor) | $20–100 | $60–300 | Max plans $100–200/mo exist; Pro is enough to start — verify at claude.com/pricing |
| Hosting (Vercel Pro — Hobby is non-commercial) | $0–20 | $0–60 | Free during private prototype, Pro from launch |
| Database (Supabase, EU region) | $0–25 | $0–75 | Free tier until real users |
| Object storage (Cloudflare R2) | ~$1 | ~$3 | No egress fees |
| LLM API tokens (dev + design partners) | $30–100 | $90–300 | Batch API halves bulk onboarding |
| Domain + email sending | $2–20 | $20–60 | Resend free tier covers early volume |
| Legal templates (ToS, privacy, DPA) | one-time | $100–300 | Termly/iubenda or a template pack; lawyer review later |
| Monitoring/analytics (Sentry, PostHog EU) | $0 | $0 | Free tiers |
| **Total** | | **≈ $300–1,100** | Fits your $500–1,000 if you stay on free tiers until users arrive |

### 8.2 Marketing and sales (months 4–12)

| Item | Monthly | Notes |
|---|---|---|
| Baseline tooling (email marketing, scheduling, LinkedIn) | $0–50 | Free tiers exist for all of it |
| Content production | $0 | You + intern; your time is the cost |
| Newsletter sponsorships (2–3 tests) | $200–1,000 per placement, optional | Only after 20 paying customers |
| One seller event (UK or EU) | $1,000–2,000 one-time, optional | Prosper/Amazon Accelerate-type events; only if partners will be there |
| Referral payouts | 10–20% of referred revenue | Variable, self-funding |
| Merchant-of-record fees | ~5% + card fees | Variable |
| **Baseline** | **$100–300/month**; **$3–6K for year one all-in** if you take the optional items | Exceeds your initial $1K — fund from revenue after 12 December, not savings |

### 8.3 What you should *not* spend on

Paid search (bureaus outbid you), a designer (use shadcn/ui and one template), an LLC before revenue (California's $800/year franchise tax would eat most of your capital; a sole proprietorship with a city business licence and an EIN satisfies the OPT documentation standard — confirm with your attorney), and any regulatory "database" subscription — build the catalog from primary sources.

---

## 9. Legal, immigration and operational constraints

- **Until 12 December 2026 (F-1, no work authorisation):** research, interviews, prototype building and unpaid design-partner testing are preparatory; incorporating, invoicing or taking payments is not. Confirm the line with your DSO and the immigration attorney.
- **From 12 December (OPT):** the business is your OPT employment only if it is related to your CS degree (it is: document AI, rule engines, integrations), you work 20+ hours/week on it, and you can show a business licence/EIN and active engagement. Keep the repo, specs and a written degree-relevance narrative from day one.
- **Entity and payments:** sole proprietorship + EIN + city licence at first; use a merchant-of-record (Paddle or similar) so EU/UK VAT on SaaS is handled for you; LLC when revenue justifies $800/year.
- **GDPR:** your customers are in the EU/UK. Host data in an EU region, sign the standard DPAs of your vendors, publish a privacy policy and DPA, support deletion requests, and minimise personal data sent to AI providers.
- **Liability:** you are an *information and document-management tool*, not a certifier, RP, or legal adviser. Every readiness score carries a disclaimer; every rule cites its source; the customer confirms. Buy professional liability insurance once revenue exceeds ~$2K/month.
- **Retention:** GPSR expects technical documentation retained for 10 years — design storage and export around that.
- **Xylo:** this product is not in insurance and does not use Xylo code or methodology documents. Still read the intern agreement for IP-assignment and confidentiality clauses before writing a line of code.
- **Naming:** pick a name after a trademark search (EUIPO, UKIPO, USPTO) and a domain check. Candidates to check: *Conformly*, *SKUfile*, *Techfile*, *Marketready* — all unverified.

---

## 10. Validation plan and go/no-go gates

The point of the next three months is to find out cheaply whether the wedge is real. Each gate has a pass condition and a kill condition.

**Gate 1 — Problem validation (by 5 October 2026)**
- Do: 15 interviews — 8 UK/EU brands with 20+ SKUs, 3 Amazon agencies, 3 RP bureaus, 1 test lab. Ask about the last time a listing was suppressed, how they got documents from suppliers, what they pay today, and what they would pay to make it go away.
- Pass: ≥8 brands rank "getting/verifying supplier documents" or "knowing what each SKU needs per market" as a top-3 pain and say they would pay ≥$29/month; ≥2 bureaus open to a referral arrangement.
- Kill: brands say the bureau "handles it" and they are satisfied; or nobody can name a document they lack.

**Gate 2 — Demand validation (by 15 November 2026)**
- Do: landing page + free multi-market scanner; forum engagement; outreach to design partners.
- Pass: ≥150 scanner uses or ≥100 waitlist signups; ≥10 design partners onboard and upload real documents.
- Kill: <50 scans after four weeks of honest community work; design partners do not upload documents (the product has no pull).

**Gate 3 — Willingness to pay (by 31 January 2027)**
- Do: enable billing on 12 December; convert design partners.
- Pass: ≥8 paying customers; ≥1 partner-referred customer; design-partner retention ≥70%.
- Kill: <5 paying, or churn of design partners >40% in the first month.

**Standing kill signals:** Amazon launches document storage/workflow inside MYC; a Group-B platform launches self-serve under $100/month; the EU materially rolls back GPSR/PPWR obligations for your ICP.

If Gate 3 passes, you have a business worth 20 hours/week during OPT. If it fails, you have a repo, a rule catalog, a network of bureaus and sellers, and a clear answer — and we move to idea #1 (ISSS for small schools) with everything learned.

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Amazon expands MYC into document management | Medium | High | Multi-channel; own supplier/verification side; export into MYC |
| Group-B AI platforms launch self-serve tiers | Medium | High | Speed; price; marketplace-native; agency channel; watch quarterly |
| Bureaus bundle "software" that is good enough | Medium | Medium | Partner first; be their front-end; white-label |
| Regulatory simplification reduces obligations (EU Omnibus proposals) | Low–Medium for non-EU sellers; higher for EU-established | Medium | ICP #1 is UK/non-EU sellers, whose obligations are not suspended; diversify to UK/US modules |
| Seller churn and market compression | High | Medium | Agencies and bureaus as stickier customers; annual plans; services bridge |
| A wrong readiness verdict causes a customer loss | Medium | High | Deterministic catalog with sources; disclaimers; human review; insurance |
| Solo bandwidth (5 hrs/week until December; job search in parallel) | High | High | Ruthless v1 scope; gates; intern for content; stop if a full-time job changes the calculus |
| Vendor price shock (AI provider) | Low | Medium | Provider-agnostic layer; open-weight fallback; batch and caching |
| Payment/VAT complexity across EU/UK | Medium | Low | Merchant-of-record |
| Chinese-supplier document fraud shows the tool's limits | Medium | Medium | Verification labelled as "signals," never "verified"; escalate to labs/bureaus |

---

## 12. Open questions for you

1. **Which ICP first — UK sellers or agencies?** UK sellers are more numerous; agencies convert faster and churn less. My recommendation is UK brands for discovery and agencies for the first paid tier, but you should pick based on who answers you in the first two weeks.
2. **Category focus for the catalog.** Depth beats breadth. Toys/children's products (heaviest enforcement) or general goods (largest base)? Start with the category your first 10 design partners sell.
3. **Are you willing to do the services bridge** (paid audits) in 2027 if SaaS growth is slow? It is the fastest route to $3K/month but it is work-for-money.
4. **Do you have any existing contacts** in UK/EU e-commerce (ex-Amazon-seller peers, Yardi colleagues who moved into e-commerce, LimeWare-era suppliers or agencies)? Even two warm intros change Gate 1.
5. **Time reality check:** Gate 1 needs ~15 hours of interviews in four weeks on top of three courses and Xylo. If that is not available, we stretch the gates by a month rather than skip them.

---

*Sources consulted for this report are cited in the accompanying chat message; figures from third parties (seller counts, bureau prices, enforcement statistics) are as published by those sources and should be re-verified before being used externally. This document is business analysis, not legal or immigration advice.*
