# Product Compliance File Manager — Technical Plan
## v1 build (12 weeks) → v2 → v3, for a solo founder

Companion document: `01-business-report-product-compliance-file-manager.md`
Date: 7 September 2026

---

## 1. Engineering principles (decide these once, then stop deciding)

1. **The LLM is a replaceable component.** Every AI call goes through one internal module with a provider adapter. Three commercial providers plus one open-weight route must work on day one. No product feature may depend on a single vendor's model.
2. **Rules are deterministic; AI only reads.** What applies to a SKU is computed by a versioned, human-reviewed requirement catalog. The LLM classifies documents and extracts fields; it never decides what the law requires.
3. **Boring stack, one language.** TypeScript end to end (you shipped production TypeScript at FiPet and your portfolio is Next.js). One repo, one deploy. Python only if a specific library forces it, and then as an isolated worker.
4. **EU data residency by default.** Customers are EU/UK. Database and files live in an EU region.
5. **Everything is auditable.** Every status change, extraction, export and user action is logged. A customer must be able to produce a technical file with a full history.
6. **Build for one person to operate.** Managed services over self-hosting. Free tiers until real users. No Kubernetes, no microservices, no custom auth.
7. **Ship weekly, behind flags.** Trunk-based development, preview deployments, feature flags for anything a design partner should not see yet.

---

## 2. Architecture

```
 Browser (Next.js App Router, React, shadcn/ui, Tailwind)
        │  server actions / route handlers
        ▼
 Next.js on Vercel (Frankfurt region) ──────────────┐
   ├── Auth (Supabase Auth)                          │
   ├── Domain services (TypeScript packages)         │
   │     ├── catalog/     requirement engine + rules │
   │     ├── documents/   ingest, classify, extract  │
   │     ├── verify/      report checks & signals    │
   │     ├── channels/    Amazon/Shopify/bol exports │
   │     └── ai/          provider-agnostic gateway  │
   └── Jobs (Inngest functions, durable, retried) ◄──┘
        │
        ├── Postgres (Supabase, eu-central-1) — RLS per organisation, pgvector, FTS
        ├── Object storage (Cloudflare R2, EU jurisdiction) — originals, renders, exports
        ├── AI providers (Anthropic / OpenAI / Google / OpenRouter open-weight)
        ├── Email (Resend) — supplier requests, alerts, digests
        ├── Payments (Paddle, merchant of record) — VAT handled
        └── Observability (Sentry errors, PostHog EU product analytics, Vercel logs)
```

**Why this shape:** a single Next.js app covers UI and API; Inngest gives you durable background jobs (document processing, reminders, re-evaluation) without running a queue; Supabase gives Postgres + auth + row-level security in an EU region; R2 avoids egress bills when customers download their technical files. Nothing here needs a GPU (see §6.6).

---

## 3. Stack — choices, rationale, alternatives

| Layer | Choice | Why | Alternative if it fails you |
|---|---|---|---|
| Language | TypeScript (strict) | One language for UI, API, jobs, rules | Python for a worker only |
| Framework | Next.js 15+ (App Router, Server Actions) | You know it; Vercel deploys; RSC reduces API surface | Remix / SvelteKit |
| UI | Tailwind + shadcn/ui + Radix | Accessible components, no designer needed | Mantine |
| Forms/validation | react-hook-form + Zod | Zod schemas double as extraction schemas | — |
| ORM | Drizzle | Type-safe SQL, migrations, works with Supabase | Prisma |
| Database | Supabase Postgres (eu-central-1), RLS, pgvector, FTS | Managed, EU region, auth included, free tier | Neon (EU) + Auth.js |
| Auth | Supabase Auth (email magic link + Google), MFA | Zero custom auth code | Clerk |
| Storage | Cloudflare R2 (EU jurisdiction restriction on the bucket) | S3-compatible, no egress fees | Supabase Storage |
| Background jobs | Inngest (free tier) | Durable steps, retries, cron, event-driven | Trigger.dev; pg-boss |
| AI gateway | Vercel AI SDK with provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, OpenRouter for open-weight) | Structured outputs, streaming, swappable providers | LiteLLM proxy |
| PDF handling | Render pages to PNG in a job (pdfium/mupdf bindings); text layer via `unpdf`/`pdfjs-dist` | Vision-capable models read rendered pages; text layer used when present | Python worker with PyMuPDF |
| OCR fallback | Tesseract.js / PaddleOCR (self-hostable) for cost control on high volume | Free; only when volume makes API vision expensive | Google Document AI |
| Rules engine | Own: JSON catalog + TypeScript evaluator | Must be versioned, explainable, cited | json-rules-engine |
| Search | Postgres FTS; pgvector for "find the report that covers this SKU" | No extra service | Typesense |
| Email | Resend + React Email | Transactional templates in code | Postmark |
| Payments | Paddle (merchant of record) | Handles EU/UK VAT, invoices, chargebacks; sole-prop friendly | Lemon Squeezy (MoR); Stripe + Stripe Tax later |
| Hosting | Vercel Pro ($20/mo; Hobby is non-commercial) | Preview deploys, edge, logs | Railway / Fly.io for long-running jobs |
| Errors | Sentry (free tier) | — | — |
| Analytics | PostHog Cloud EU (free tier) | Funnels, feature flags, session replay | Plausible |
| Support | Crisp (free) or plain email | — | Plain |
| Docs/help | `/docs` in the app (MDX) | No extra tooling | Mintlify |
| DNS/CDN | Cloudflare | Free; pairs with R2 | — |
| Repo/CI | GitHub + GitHub Actions | Lint, typecheck, tests, migration check | — |
| Dev tooling | Claude Code (Pro/Max) or Cursor; a spec per feature | Your working mode | — |

**Vendor DPAs to sign before real customer data:** Supabase, Vercel, Cloudflare, Resend, Paddle, PostHog, Sentry, and each AI provider. Anthropic's first-party API routes globally by default; a US-only `inference_geo` option exists at a 1.1x price — irrelevant for you, but know that EU-only inference is not a first-party option, so minimise personal data in prompts (see §9).

---

## 4. Data model

Core entities (Postgres, all scoped by `organisation_id` with RLS):

| Entity | Key fields | Notes |
|---|---|---|
| `organisation` | name, plan, billing_customer_id, establishment_country, is_agency | Establishment country drives "non-EU" logic |
| `user`, `membership` | role (owner/admin/member/viewer), MFA | Agency users belong to many organisations |
| `client` (agency only) | organisation_id → managed brand | Agency tier: parent org manages child orgs |
| `product` (SKU) | sku, title, brand, category_code, materials[], has_battery, is_electrical, is_toy, age_grade, gtin, asin, manufacturer_id, rp_id | Category taxonomy = your own, mapped to Amazon product types |
| `variant` | product_id, attributes | Optional in v1 |
| `market` | iso_country, jurisdiction (EU/UK/US), currency | Seed table |
| `channel` | type (amazon_de, amazon_fr, shopify, bol, etsy, ebay), credentials_ref | Per organisation |
| `listing` | product_id, channel_id, external_id, last_synced, compliance_flags_json | v2 sync target |
| `party` | type (manufacturer/importer/responsible_person/authorised_representative/supplier/lab), name, address, email, country | RP and AR are parties |
| `requirement` | catalog_id, version, jurisdiction, regulation, article_ref, applies_when_json, required_evidence[], required_data[], channel_mappings_json, effective_from, effective_to, sources[], last_reviewed_at | See §5 |
| `assessment` | product_id, market_id, channel_id?, requirement_id, status (unknown/missing/pending/partial/met/expired/na), evidence_ids[], computed_at, catalog_version | The system-of-record cell |
| `document` | storage_key, sha256, mime, pages, uploaded_by, source (user/supplier/channel), status | Immutable original |
| `extraction` | document_id, doc_type, fields_json, confidence, model, prompt_version, reviewed_by, reviewed_at | Multiple per document over time |
| `evidence_link` | document_id, product_id, requirement_id, valid_from, valid_to | The join that makes a cell "met" |
| `supplier_request` | product_ids[], party_id, requested_items[], token, sent_at, due_at, status, reminders_sent | Magic-link upload |
| `verification` | document_id, checks_json (accreditation, standard_version, product_match, tamper), signal_level | v2 |
| `alert` | organisation_id, type, payload_json, due_at, sent_at, acknowledged_at | Expiries, catalog changes, sync flags |
| `catalog_change` | catalog_version, summary, affected_requirement_ids[], published_at | Drives re-evaluation + customer digest |
| `export` | type (amazon_myc_csv, shopify_csv, technical_file_pdf), storage_key, created_at | Reproducible |
| `audit_log` | actor, action, entity, before/after, at | Append-only; never deleted |

Indexing: `(organisation_id, product_id)`, `(organisation_id, status)`, `evidence_link(valid_to)`, FTS on `extraction.fields_json`, vector index on document embeddings.

---

## 5. The requirement catalog — your actual moat

### 5.1 Schema (one JSON file per requirement, versioned in git, compiled to DB on deploy)

```json
{
  "id": "eu.gpsr.responsible_economic_operator",
  "version": "2026.09",
  "jurisdiction": "EU",
  "regulation": "Regulation (EU) 2023/988 (GPSR)",
  "article_ref": "Art. 16 (verify)",
  "title": "EU-established responsible economic operator",
  "applies_when": {
    "all": [
      { "market.jurisdiction": "EU" },
      { "manufacturer.country_in_eu": false }
    ]
  },
  "required_data": [
    { "key": "rp.name", "label": "Responsible person name" },
    { "key": "rp.address", "label": "Postal address in the EU" },
    { "key": "rp.contact", "label": "Email or URL" }
  ],
  "required_evidence": [
    { "type": "rp_mandate", "label": "Signed mandate/appointment", "expires": true }
  ],
  "channel_mappings": {
    "amazon": { "attribute_group": "compliance", "note": "Pull exact attribute keys from Product Type Definitions API; do not hard-code" },
    "shopify": { "metafield_namespace": "compliance", "key": "eu_responsible_person" }
  },
  "effective_from": "2024-12-13",
  "effective_to": null,
  "sources": [
    { "title": "GPSR text (EUR-Lex)", "url": "https://eur-lex.europa.eu/..." }
  ],
  "confidence": "high",
  "last_reviewed_at": "2026-09-07",
  "reviewer": "TR"
}
```

Rules: every requirement cites a primary source; `applies_when` is a small boolean DSL evaluated in TypeScript (no LLM); every change bumps `version` and produces a `catalog_change` record; a nightly job re-evaluates all assessments against the current version and raises alerts on status changes.

### 5.2 v1 scope (write these first; each is a research task an intern can draft and you verify)

| Area | Requirements to encode | Notes |
|---|---|---|
| GPSR core (EU) | Manufacturer identification on product/listing; responsible economic operator for non-EU manufacturers; distance-selling information on listings; technical documentation incl. risk analysis; 10-year retention; recall/Safety Gate readiness | Article numbers must be verified against EUR-Lex before publishing |
| DSA trader traceability (EU) | Trader identity/contact/registration data required by marketplaces | Amazon and bol enforce via listing fields |
| EPR packaging — DE | LUCID registration + dual-system contract; registration number in channels | Cheapest, most enforced |
| EPR packaging — FR | Citeo (or equivalent) registration; unique identifier; Triman/Info-tri labelling | Labelling is a data item |
| EPR packaging — ES, IT, NL, AT, BE | Registry/scheme per country; registration numbers | Amazon verifies all EU countries from 12 Aug 2026 |
| PPWR (EU) | Producer registration per member state (Art. 44); authorised representative per member state where not established (Art. 45); packaging Declaration of Conformity; packaging composition data | Regulation applies since 12 Aug 2026 |
| WEEE / batteries | Flag-only in v1: registration required if electrical/battery | Full module v2 |
| CE-directive categories | Flag-only in v1: toys (EN 71), LVD/EMC/RED, PPE → "test report + DoC required" | Category depth v2 |
| UK | Flag divergences: UK responsible person for UKCA/CE goods; UK GPSR (2005 regs) baseline | Separate jurisdiction switch |

Sources to work from: EUR-Lex texts, Commission FAQs and guidance, national register sites (LUCID, Citeo, the Spanish registry, CONAI, Verpact, ARA), Amazon Seller Central help pages and MYC templates, bol.com partner documentation. Keep a `sources.md` with retrieval dates.

### 5.3 Change monitoring (semi-automated)

Weekly Inngest cron pulls: EUR-Lex RSS for the regulations in scope, Commission product-safety news, Amazon Seller Central announcements (EU), bol.com partner updates, selected bureau blogs. An LLM summarises diffs into a review queue; **you** decide whether a requirement changes. Published changes become (a) a `catalog_change`, (b) a customer digest email, (c) a blog post. This is product and marketing in one loop.

---

## 6. AI pipeline

### 6.1 Flow

```
upload → virus scan → store original (R2) → hash → render pages (PNG) + text layer
 → classify doc type (Haiku) → extract fields per doc-type schema (Sonnet, structured output)
 → deterministic validation (dates, numbers, standards list, country codes)
 → confidence gate → auto-link to SKU/requirement  or  human review queue
 → assessment recompute → alerts
```

### 6.2 Document types and extraction schemas (Zod → JSON Schema)

`test_report` (lab, accreditation body/number, report number, issue date, standards[] with versions, product description, model/SKU refs, applicant, results pass/fail), `declaration_of_conformity` (manufacturer, RP/AR, product ids, directives/regulations, standards, signatory, date), `material_declaration`, `rp_mandate`, `epr_certificate` (scheme, country, registration number, validity), `label_artwork` (text content, marks present), `invoice_or_spec` (for identification only), `other`.

### 6.3 Model routing (all through the gateway; names are config, not code)

| Task | Default | Fallback 1 | Fallback 2 (open-weight) |
|---|---|---|---|
| Classification, short JSON | Claude Haiku 4.5 | Gemini Flash-class | Qwen2.5-VL 7B via OpenRouter |
| Extraction from rendered pages | Claude Sonnet 5 | GPT-class mid model | Qwen2.5-VL 72B via OpenRouter |
| Bulk onboarding (hundreds of docs, non-urgent) | Same models via Batch API (50% off) | — | — |
| Catalog-change summarisation (internal) | Sonnet 5 | any | any |
| Never by default | Opus-class | | Only for a "deep review" button, if ever |

The gateway records model, prompt version, tokens and cost per call in `extraction`, so you can see your COGS per customer and switch providers on price.

### 6.4 Prompting and quality

- Prompt caching for the long, stable parts (schema + instructions): cache reads are 10% of input price on current Claude models.
- Structured outputs with strict schemas; reject and retry on validation failure.
- A **golden set** of 50 labelled documents (start with public sample test reports and DoCs; add design-partner docs with permission). CI runs the extraction eval on every prompt change and reports field-level accuracy. Ship no prompt change that lowers accuracy.
- Confidence gate: auto-accept only when required fields are present and validators pass; otherwise a human-review card with the page image and the extracted fields side by side.

### 6.5 Cost worked example (official Claude API list prices as of Sept 2026: Haiku 4.5 $1 in / $5 out per MTok; Sonnet 5 $2 / $10; Opus 5 $5 / $25; Batch API −50%; cache reads 0.1× input)

A 12-page test report rendered at ~1000×1400 px ≈ 1,900 image tokens per page ≈ 23K tokens, plus ~3K prompt tokens, ~1.5K output tokens.

| Route | Input cost | Output cost | Per document |
|---|---|---|---|
| Sonnet 5, standard | 26K × $2/M = $0.052 | 1.5K × $10/M = $0.015 | **≈ $0.07** |
| Sonnet 5, batch | | | ≈ $0.035 |
| Haiku 4.5 (classification pass, 2 pages) | 5K × $1/M | 0.3K × $5/M | ≈ $0.007 |

Onboarding a 100-SKU brand with three documents each ≈ 300 docs ≈ **$10–25 one-time** (batch, mixed routing). Ongoing: a few documents a month per customer → **< $1–3/month per customer**. Gross margin is not an AI-cost problem; it is a support-time problem.

### 6.6 GPUs — when (not now)

Do not rent a GPU for v1. Self-hosting an open-weight vision model (e.g., Qwen2.5-VL 7B on a rented L4/A10-class GPU at roughly $0.4–0.8/hour on RunPod/Modal/Vast-type services, or serverless per-second billing) only beats the API above roughly 20–30K pages/month, and it adds ops burden you cannot afford alone. The correct hedge against API price shocks is the gateway + OpenRouter open-weight route, which costs nothing until you use it. Revisit at 200+ customers.

### 6.7 What you are explicitly *not* building with AI

- No chatbot that "answers compliance questions" in v1 (liability, weak differentiation).
- No AI-decided applicability (catalog does that).
- No generated Declarations of Conformity until v2, and then as drafts populated from extracted data with mandatory human sign-off.

---

## 7. Verification module (v2; design now so the data model supports it)

Signals, never verdicts. Each check writes a signal to `verification.checks_json` and contributes to a "review recommended" flag.

| Check | Method | Data needed |
|---|---|---|
| Lab accreditation | Match lab name + accreditation number against accreditation-body lists (national bodies under ILAC/EA/UKAS/DAkkS-type registries); cache lookups | Curated lab table; manual seeding |
| Standard currency | Compare cited standard versions to a maintained table of current versions and withdrawal dates for the standards in scope | `standards.json`, reviewed quarterly |
| Report ↔ product match | LLM compares report scope/photos/model numbers to SKU data; outputs match score + reasons | Existing extraction |
| Tamper signals | PDF metadata anomalies (producer/modified dates), font/layer inconsistencies, image splicing heuristics on rendered pages | Your TruPhoto/Stereon background applies here; keep it as heuristics |
| Expiry | Report age vs. category norms; RP mandate term; EPR validity | Catalog rules |
| Duplicate/reuse | Same report hash or number across unrelated SKUs/organisations (privacy-preserving hash only) | Global hash index |

---

## 8. Integrations

### 8.1 v1 — file-based (no API approvals needed)

- **Amazon Manage Your Compliance bulk template**: generate the CSV in Amazon's current template from assessment data; user uploads in Seller Central. Keep templates as versioned fixtures; re-check monthly.
- **Shopify**: products CSV with compliance metafields; optionally a Shopify Flow/metafield definition guide.
- **bol.com**: field export matching their compliance fields.
- **Technical file PDF**: per SKU, per market — cover sheet, requirement matrix, evidence list, embedded documents, audit trail. Generated in a job (React-PDF or headless Chromium), stored in R2, downloadable/sharable via expiring signed URL (for RP/authority).

### 8.2 v2 — API sync

| Channel | API | Notes |
|---|---|---|
| Amazon | Selling Partner API: Reports (catalog pull), Listings Items (read/write attributes), Product Type Definitions (attribute schemas per product type/marketplace), Notifications (listing issues) | Requires developer registration and app approval — start the application in month 2; it can take weeks. Never hard-code attribute keys; fetch definitions. |
| Shopify | Admin GraphQL API; app with metafield definitions; App Store listing | Partner account is free; review process applies |
| eBay | Sell APIs regulatory fields (manufacturer/RP) | Later |
| Etsy | Open API v3 (limited) | Later; Etsy sellers are small |
| bol.com | Retailer API | Later; NL/BE |

Each integration is a `channels/<name>` module with: auth, pull, map (catalog ↔ external attributes), diff, push (behind a flag), and a fixture-based test suite.

---

## 9. Security, privacy and compliance engineering

- **Tenant isolation:** Postgres RLS on every table keyed by `organisation_id`; service-role key only in jobs; policies tested in CI.
- **Encryption:** TLS everywhere; R2 and Supabase encrypt at rest; documents served only via short-lived signed URLs.
- **Auth:** magic link + OAuth; MFA available; session limits; admin actions logged.
- **Uploads:** size limits, MIME sniffing, ClamAV scan in the job (or a hosted scanning API), quarantine on failure.
- **Audit log:** append-only table; exportable per organisation.
- **Backups:** Supabase daily backups (PITR when on Pro); weekly R2 → second bucket copy; a restore drill once before launch.
- **GDPR:** EU-region hosting; DPA with each vendor; privacy policy + DPA for your customers; data-subject deletion workflow (documents may contain supplier/lab personal data); retention setting per organisation (default 10 years for compliance evidence, per GPSR expectations); minimise personal data in AI prompts (strip signatory names/emails before extraction where not needed; never send more pages than required).
- **AI provider hygiene:** review each provider's data-usage terms and zero-retention options; log which provider processed which document.
- **Secrets:** Vercel/Inngest environment variables; rotate on any incident; no secrets in the repo.
- **Rate limiting & abuse:** per-organisation upload and AI quotas by plan; free tier hard caps.
- **Legal surface:** disclaimer on every readiness score ("information tool, not legal advice or certification"); terms require customer confirmation before export; E&O insurance when revenue justifies it.
- **Status page:** free tier of any status service, or a static page.

---

## 10. Build plan

### 10.1 Weeks 1–12 (v1) — roughly 5 hrs/week until December, then more

| Week | Deliverable | Definition of done |
|---|---|---|
| 1 | Repo, Next.js app, Supabase (EU), Drizzle schema for organisation/user/product/market/requirement/assessment, RLS policies, CI (lint, typecheck, tests) | Deploys to preview; a user can sign in and create an organisation |
| 2 | Catalog v0: 15 requirements (GPSR core, DSA, EPR DE/FR, PPWR core) in JSON with sources; evaluator + unit tests | Given a SKU + markets, correct requirement list with citations |
| 3 | Product import (CSV) + product table UI + assessment matrix (SKU × market) | 100-SKU CSV imports in <10s; matrix renders |
| 4 | Document upload → R2 → job → page render → classification (Haiku) via gateway with 3 providers wired | Upload a PDF, see doc type in UI; provider switch works via env |
| 5 | Extraction schemas for test_report / DoC / rp_mandate / epr_certificate; structured output; validators; golden set (20 docs) + eval script | ≥90% field accuracy on golden set |
| 6 | Evidence linking (auto + manual), assessment recompute, gap list per SKU/market | A design partner's SKU goes from red to green by uploading the right docs |
| 7 | Supplier request flow: template (EN/ZH), magic-link upload page, reminders (Inngest cron) | Supplier without an account can upload; status updates |
| 8 | Alerts: expiries, missing items, weekly digest email | Emails send; acknowledged state persists |
| 9 | Exports: Amazon MYC CSV, Shopify CSV, technical file PDF | Files validate against current templates |
| 10 | Free scanner (public page): CSV → per-SKU gap list for one market; captures email | Deployed; PostHog funnel live |
| 11 | Billing (Paddle), plans/quotas, onboarding checklist, help docs | Test purchase works in sandbox; quotas enforced |
| 12 | Hardening: RLS tests, backup drill, load test (10K SKUs), security review checklist, DPAs signed | Ready to charge on 12 December |

Design partners start using week 6 builds. Every Friday: deploy, write a one-paragraph changelog, send it to partners.

### 10.2 v2 (months 4–9)

Amazon SP-API sync (apply for developer access in month 2); Shopify app; verification module (§7); label-text generator; DoC/risk-assessment drafts with sign-off; PPWR packaging data capture + EPR reporting calendar; agency tier (parent/child organisations); catalog expansion (WEEE/batteries, CE categories, UK detail).

### 10.3 v3 (months 9–24)

US module (CPSIA/CPC, Prop 65, FCC), DPP readiness, white-label for bureaus, partner marketplace (labs, RPs) with referral tracking, public API for agencies, Chinese-language supplier portal.

---

## 11. Development process and tooling

- **Spec first, then code.** One markdown spec per feature: problem, user story, data changes, UI states, edge cases, test cases, out of scope. Feed the spec to Claude Code; review the diff like a code reviewer, not an author. (Use your own spec format — do not reuse Xylo's internal methodology documents.)
- **Branching:** trunk-based; short-lived branches; preview deploy per PR; squash merge.
- **Tests:** Vitest for the catalog evaluator, validators and channel mappers (these are where bugs cost customers); Playwright for the three golden paths (import → upload → export); the extraction eval in CI.
- **Feature flags:** PostHog flags for anything partner-facing but unfinished.
- **Observability:** Sentry for errors with organisation context; PostHog for funnels; a `/admin` page showing AI spend per organisation and job failures.
- **Documentation:** `docs/` with architecture, runbook, catalog authoring guide, and the OPT-relevance narrative (repo, specs, and a short "how this relates to my CS degree" page — keep it current; it is your immigration evidence).
- **Time budget until December:** ~5 hrs/week means one deliverable per week only if scope is ruthless. Anything not in the table above is v2.

---

## 12. Cost model by scale (monthly, USD, estimates)

| Item | Build (0 customers) | 50 customers | 200 customers |
|---|---|---|---|
| Vercel | $0 (Hobby, private) → $20 Pro at launch | $20 | $20–40 |
| Supabase | $0 | $25 (Pro) | $25–75 |
| Cloudflare R2 (≈50 GB / 500 GB) | ~$1 | ~$8 | ~$25 |
| Inngest | $0 | $0–20 | $50 |
| AI API (extraction + monitoring) | $30–100 | $50–150 | $150–400 |
| Resend | $0 | $0–20 | $20 |
| Sentry / PostHog | $0 | $0 | $0–50 |
| Paddle (MoR) | — | ~5% + card fees | ~5% + card fees |
| Domain, misc | $5 | $5 | $10 |
| Claude Code / Cursor | $20–100 | $20–100 | $100 |
| **Total** | **≈ $60–230** | **≈ $130–350 + ~5% of revenue** | **≈ $400–800 + ~5%** |

At 50 customers (~$3–4K MRR) infrastructure is under 10% of revenue.

---

## 13. Operations runbook (one page you will thank yourself for)

- **Daily (5 min):** Sentry inbox; job failures in Inngest; AI spend anomaly.
- **Weekly:** deploy + changelog; catalog-change review queue; backup check; partner digest.
- **Monthly:** re-verify channel templates (Amazon MYC, Shopify); review provider prices; churn/retention review; standards-table review.
- **Quarterly:** competitor scan (Amazon MYC features, Group-B self-serve tiers); restore drill; dependency updates; DPA/vendor review.
- **Incident basics:** status page update → stop the failing job → communicate to affected organisations → post-mortem in `docs/incidents/`.
- **Support:** reply within one business day; every ticket tagged to a feature; the top three tags each month become next month's roadmap.

---

## 14. Intern-ready work packages (unpaid, for university credit — verify the arrangement)

1. Catalog research drafts: one country's EPR scheme per week (registration body, fees, labelling, sources) in the catalog JSON format — you verify and publish.
2. Golden-set curation: collect public sample test reports/DoCs, label fields.
3. Standards table: current versions and withdrawal dates for the standards in scope.
4. Content: market × category × channel explainer pages from the catalog; monthly change digest drafts.
5. Community monitoring: log GPSR/EPR/PPWR threads weekly with the questions asked (feeds product and content).
6. QA: run the golden paths on each Friday build; file issues.

Never give an intern production access, customer documents, or AI provider keys.

---

## 15. Appendix

### 15.1 Repository layout

```
/apps/web            Next.js app (UI, route handlers, server actions)
/packages/catalog    requirement JSON, evaluator, tests, authoring guide
/packages/ai         gateway, provider adapters, prompts (versioned), eval harness
/packages/documents  render, classify, extract, validators, schemas
/packages/channels   amazon/, shopify/, bol/ — mappers, templates, fixtures
/packages/db         drizzle schema, migrations, RLS policies, seed
/packages/emails     React Email templates
/jobs                Inngest functions
/docs                architecture, runbook, catalog guide, OPT narrative
/golden-set          labelled documents (private, git-lfs or R2)
```

### 15.2 Extraction schema example (test report, abbreviated)

```ts
const TestReport = z.object({
  lab_name: z.string(),
  accreditation_body: z.string().nullable(),
  accreditation_number: z.string().nullable(),
  report_number: z.string(),
  issue_date: z.string().date(),
  applicant: z.string().nullable(),
  product_description: z.string(),
  model_numbers: z.array(z.string()),
  standards: z.array(z.object({ code: z.string(), version: z.string().nullable(), result: z.enum(["pass","fail","na"]) })),
  overall_result: z.enum(["pass","fail","partial","unclear"]),
  page_refs: z.record(z.string(), z.number()) // field → page number, for review UI
});
```

### 15.3 Assessment status semantics

`unknown` (not yet evaluated) → `missing` (required, no evidence) → `pending` (supplier request open) → `partial` (some data, review needed) → `met` (evidence linked and valid) → `expired` (evidence past validity) → `na` (requirement does not apply). Only `met` and `na` count toward "market-ready".

### 15.4 Gate checks that must pass before charging (12 December 2026)

RLS tests green · backup restore drill done · DPAs signed · privacy policy/ToS live · disclaimer on scores · billing sandbox → live · quotas enforced · error alerting on · one design partner has exported a technical file and uploaded an MYC CSV successfully.

---

*Prices and vendor tiers cited here are as published at the time of writing and change frequently; the plan is built so that any single vendor can be swapped.*
