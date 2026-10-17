# 07 · AI API calls: what we decided, how they're built, and what we traded

**Status:** Reference, consolidating existing decisions. It adds none of its own.
**Written:** 16 October 2026, from the code on `main` and the decision log.
**Read with:** `decisions.md` (D-004, D-007, D-009, D-013, D-014, D-016–D-018, D-029, D-031,
D-037, D-051, D-053), `packages/ai/README.md`, `03-plan-review.md` §D-3, §D-6, §D-8.

Vendor facts below (model ids, prices, retention, data location) were verified on the dates
given. Per `tabeen_CLAUDE.md`, re-read Anthropic's current documentation before relying on any of
them again.

---

## 1. In one paragraph

The model has exactly one job in production: **reading an uploaded compliance document** (an EU
responsible-person mandate or an EPR registration certificate) to find fields like names,
registration numbers and dates. It never decides what the law requires — the human-reviewed
catalog does — and it never decides whether its own answer is good enough — deterministic code
does. Code tries first; the model is asked only for what code couldn't find, in a JSON schema
narrowed to exactly those fields, inside a token budget and a spend cap checked before the request
leaves. Anthropic is the one provider, reached through the official TypeScript SDK from a single
file, behind a provider-agnostic gateway. Uploads, and therefore every call, are switched off in
production until the legal paperwork is done (D-013).

## 2. How a call is structured

```
Upload ──▶ R2 (EU) ──▶ Queue ──▶ Worker queue() ─▶ processDocument ─▶ Gateway.runTask ─▶ AnthropicProvider.generate ─▶ messages.create
                                apps/web/worker/  apps/web/worker/    packages/ai/src/    packages/ai/src/providers/
                                app.ts:36         process.ts:95,134   gateway.ts:67,125   anthropic.ts:142,149
```

| Layer | File | Its responsibility |
|---|---|---|
| Queue consumer | `apps/web/worker/app.ts:36` | One message per document (`max_batch_size = 1`, `max_retries = 4`). Builds a `Gateway` with a fresh provider (`index.ts:15`, $0.10 cap) |
| Pipeline | `apps/web/worker/process.ts` | Fetches the file from R2; reads the PDF text layer locally (`unpdf`). ≥ 40 characters counts as a usable text layer; otherwise the PDF itself is sent. Calls the task, runs the gate, records the result |
| Task | `packages/ai/src/tasks/extract-document.ts:52` | Prompt and its version (`2026-09-13.1`), the narrowed schema, the budget (30,000 in / 1,500 out), the deterministic attempt, and what input to send |
| Gateway | `packages/ai/src/gateway.ts` | Runs the deterministic attempt first; checks the budget with the provider's estimate; calls the provider; records usage and cost |
| Provider | `packages/ai/src/providers/anthropic.ts` | The only file that imports `@anthropic-ai/sdk` (0.127.0). Spend cap, content mapping (text / PDF document block / image), `output_config.format` JSON schema, cost arithmetic including cache buckets |
| Gate | `@cfm/documents` `gateExtraction` | Validates every value (real dates, formats). Decides `accept` or `review`. Same gate for human-typed corrections |

What one request looks like, in the adapter:

```ts
client.messages.create({
  model,                                   // EXTRACT_MODEL = "claude-sonnet-5" (wrangler.toml)
  max_tokens: 1_500,
  system: "You read compliance documents and return only what the document states. …",
  messages: [{ role: "user", content }],   // text excerpt ≤ 60,000 chars, or the PDF, or page images
  output_config: { format: { type: "json_schema", schema } },   // only the fields still missing
});
```

## 3. The decisions

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | **The model only reads; it never decides what's required** | Compliance answers must be explainable and cited. A rule catalog can be shown to a regulator; a model's opinion can't | `02-` principle 2; D-002 |
| 2 | **Deterministic first, enforced by the gateway, not by review** | Most documents state their fields plainly. Free, reproducible answers beat paid ones; a task that declares neither an attempt nor a reason fails a test | D-016 |
| 3 | **Deterministic first at the field level too: the schema is narrowed** | The model is asked only for fields patterns didn't find. A test checks the *request* actually shrinks, not just the wording | D-031 |
| 4 | **The model never grades its own work** | Self-reported confidence is the one number a model can't calibrate. Acceptance needs every required field, every validator passing, no unconfirmed pattern, no ambiguity. Otherwise a person reviews | D-031 |
| 5 | **Structured outputs with a JSON schema** | Parseable by construction; one declaration drives the schema, the validators and the review card, so they can't drift | D-031; adapter |
| 6 | **Token budgets checked before sending** | A silent overspend is only found on the invoice. Over budget → the document goes to manual entry, no call | D-017 |
| 7 | **PDF cost estimated per page (5,000 tokens)** | A flat estimate let a 40-page PDF pass a 30k budget as one page. 5,000 = up to 3,000 text + the page image, from Anthropic's PDF docs (26 Sept) | D-051 |
| 8 | **A spend cap per document ($0.10), plus the Console cap** | Defence in depth behind the budget. A 1–3 page document costs well under a cent | D-037, D-051 |
| 9 | **One provider behind a seam; SDK imported in one file** | "No vendor lock-in" is met by an interface plus a boundary test, not by maintaining three adapters before any eval exists | D-014, D-018 |
| 10 | **Portability is tested; quality is measured** | Every task runs against three capability profiles in CI. Whether another model *reads as well* is only answerable by an eval | D-018 |
| 11 | **Send PDFs directly; don't render pages** | The API reads PDFs natively; rendering needs a native library Workers don't have. A usable text layer is sent as text instead (far cheaper) | D-007, D-051 |
| 12 | **No classification call; the uploader picks the type** | Removes a model call and its failure mode. A wrong type fails the gate and goes to review; it never becomes evidence | D-051 |
| 13 | **Model and provider are configuration, by role** | `EXTRACT_MODEL` in `wrangler.toml`; ids never appear in feature code. Sonnet 5 for extraction; Haiku 4.5 profiled for classification | D-014, D-037 |
| 14 | **Every call is costed and attributed** | Model, prompt version, tokens and USD are stored with each extraction, and deterministic resolutions at $0, so the saving is visible | D-017 |
| 15 | **No paying twice for a redelivered message** | Queues deliver at least once. An extraction already recorded for this document and prompt version skips the call | D-051 |
| 16 | **No model call from any unauthenticated path** | A public endpoint calling a paid API is an abuse surface. The scanner runs in the browser and never calls a model | D-009 |
| 17 | **Data: global routing, US at rest, disclosed** | Anthropic has no EU inference or storage option (re-verified 27 Sept). No account or organisation identifiers are sent. No training on API data; 30-day retention (2 years if flagged) | D-029, D-053 |
| 18 | **No calls until the paperwork exists** | Real documents carry third parties' personal data. `UPLOADS_ENABLED = "false"` until legal review and a working email sender | D-013, D-056 |
| 19 | **Accuracy is measured per field, after normalisation, on a golden set** | An average hides the field that matters. No prompt change ships that lowers any single field | D-004, **not yet built** |

## 4. Trade-offs we're accepting

| Choice | What we gain | What we give up | Revisit when |
|---|---|---|---|
| Deterministic first | Free, reproducible, auditable answers; fewer calls | Pattern maintenance per document type and language; a wrong pattern is a silent risk (mitigated: unconfirmed patterns always go to review) | A document type's patterns cost more upkeep than the calls they save |
| Narrowed schema | Fewer output tokens; the model can't "correct" a field code already found | The model sees the whole document but answers only part of it, so it can't cross-check what the patterns found | The eval shows pattern errors the model would have caught |
| Model never grades itself | Acceptance is explainable and conservative | More human review than a confidence threshold would give | Review volume becomes the bottleneck |
| One provider (Anthropic) | One adapter to maintain; one vendor's docs to track | No price or outage fallback; US data at rest with no EU option | An eval exists to score a swap (D-014), or an EU customer requires EU processing |
| Sonnet 5 for extraction | Strong on scanned, multilingual documents | Higher cost per token than a smaller model | The eval shows a cheaper model matches it per field |
| PDF sent whole for scans | No rendering pipeline; one request | Pays per page, image included; long scans hit the budget and go to manual entry | Many long scans arrive; then send selected pages |
| Synchronous calls, no batch | A result in seconds after upload | Batch processing is about half price; not used | Bulk onboarding (hundreds of documents at once) |
| No prompt caching | Simpler; each document's text differs anyway | Nothing material today — the shared prefix is short | Many calls per document, or a long shared prefix (e.g. a few-shot set) |
| Global inference routing | Standard price, best availability | Inference may run outside the US/EU; pinning to the US costs 1.1× | A customer asks where inference runs |
| SDK default retries (2) + queue retries (4) | Transient errors recover without code | A persistently failing document is attempted up to 15 times; failed requests generally carry no usage, but it's worth knowing | Error rates or costs show it |
| Per-document $0.10 cap | A runaway costs at most 10 cents | A legitimately expensive document is refused | Real documents show costs near the cap |

## 5. Known gaps (stated, not hidden)

1. **No golden-set eval yet (D-004).** Without it, no prompt, model or provider change can be
   judged. Everything in §6 depends on building it first.
2. **Batch is half-wired.** Tasks declare `batchable`, and the gateway sets `batch: true` when
   asked (`gateway.ts:109`), but the Anthropic adapter ignores the flag, and the Worker never asks.
3. **Caching is wired but unused.** The adapter maps `cacheable` text to `cache_control`; extraction
   sends its excerpt with `cacheable: false`.
4. **The classification task exists but isn't in production** (D-051 #12).
5. **Prices and model ids were last verified on 19 September 2026** (D-037).
6. **One live smoke test only** (D-037, $0.0017, synthetic text). No real document has been
   through the deployed Worker.

## 6. Exploring enhancements yourself

### Ground rules (keep these whatever you try)

- **Deterministic first, and the model never decides acceptance.** Change *how* the model reads,
  never *who* decides.
- **Every change has a budget and a cost record.** If the gateway can't estimate it, it doesn't ship.
- **The SDK stays in `packages/ai/src/providers/`** (`boundary.test.ts` will fail otherwise).
- **Look up current API shapes, model ids and prices in Anthropic's docs**, not from memory or this
  file.
- **API keys live only in `.env.local` and `wrangler secret`.** Never in a `VITE_` variable (the web
  build refuses that), never in a commit.

### Where to experiment, cheapest first

| Path | Command | Cost |
|---|---|---|
| Unit tests with the fake provider | `npx vitest run packages/ai packages/documents` | Free |
| The whole pipeline locally (fake provider, local R2/Queue/Supabase) | `cd apps/web && npx supabase start && npx supabase db reset`, then `npm run -w @cfm/web e2e:worker` | Free; needs Docker for local Supabase |
| One real call, synthetic text | `npm run smoke:anthropic:extract -- --confirm` | Fractions of a cent; needs `ANTHROPIC_API_KEY` in `.env.local` |
| Deterministic pass only, on any text | call `extractDeterministically` from `@cfm/documents` in a scratch script | Free |

### Step 0: build the eval (do this first)

Collect 20–50 **public** sample mandates and EPR certificates (`tabeen_AGENTS.md`: public samples
or written permission only). Label the expected value of every required field. Score each run per
field, exact match after normalisation (D-004). Keep it in the repo, run it with a `--confirm`
script like the smoke tests, and record cost per run. Every idea below is judged against it.

The `claude-api` skill in Claude Code has an interview for exactly this: **`/claude-api build-eval`**.
Then **`/claude-api hillclimb`** iterates a prompt against it, and **`/claude-api cost-optimize`**
profiles spend. Each asks before spending money.

### Ideas, roughly by expected value

| Idea | What it could buy | How to try it | Judge it by |
|---|---|---|---|
| **Try a cheaper model for extraction** | Lower cost per document | Add a capability profile in `anthropic.ts`, set `EXTRACT_MODEL` | Per-field accuracy on the eval must not drop for any field (D-004) |
| **Ask for the supporting quote per field** | Faster human review: the card shows where each value came from | Extend the field schema with a `quote` string; show it in the review card | Review time; output tokens (budget is 1,500) |
| **Send only relevant pages of long scans** | Fewer budget refusals on long PDFs | In `prepareInput`, pick pages by text-layer hits or position | Refusal rate; accuracy on long documents |
| **Implement batch for bulk work** | About half price for non-urgent backfills | Handle `request.batch` in the adapter using the Message Batches API; set `preferBatch` for backfills | Cost per document; acceptable latency |
| **Pin inference to the US** | One answer to "where is data processed?" | Pass `inference_geo: "us"` (Claude 4.6+ only; 1.1× price) | A customer requirement, not a metric |
| **Prompt caching** | Cheaper repeated prefixes | Mark the system prompt and schema `cacheable`; check the provider's minimum cacheable length first | Only worth it if one document triggers several calls |
| **Adaptive thinking for hard scans** | Better reads on poor scans | Enable on a retry path for documents that failed the gate | Accuracy on the hard subset vs added output cost |
| **Exact token counting** | A budget check without estimates | Anthropic's token-counting endpoint before sending | Refusals that the estimate got wrong; one extra request each |
| **New document types** (test reports, DoCs) | More evidence the product can read | Declare fields in `@cfm/documents/schemas.ts`; patterns first; the task adapts | Per-field accuracy on new eval samples |

### When a change is ready

1. Eval run before and after, per field, with costs.
2. Bump `promptVersion` for any prompt or schema change. Old extractions keep their version.
3. `npm test` and `npm run typecheck` green; `boundary.test.ts` and `portability.test.ts` untouched.
4. A decision entry in `decisions.md` with the eval numbers.
