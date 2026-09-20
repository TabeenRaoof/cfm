# @cfm/ai

The only place in this codebase that may talk to a model.

## Three rules, each enforced by a test rather than by review

| Rule | Enforced by |
|---|---|
| Deterministic first — a model is only reached when code cannot answer | `Gateway.runTask` runs `determinism.attempt` before anything else; `registry.test.ts` fails a task that declares neither an attempt nor a written reason there is none |
| Every task declares a token budget, and the gateway refuses to exceed it | `gateway.test.ts` — the request is never sent |
| No provider SDK outside `src/providers/` | `boundary.test.ts` walks every `.ts` file in every package |

## Swapping providers: what actually transfers

A narrow interface is necessary and not sufficient. Providers differ in ways that leak through
any interface unless they are named, so `ModelCapabilities` names them: context window, whether
a PDF can be sent as a document or must be rendered first, how a schema-valid result is obtained
(native format / tool call / prompt plus validator), whether there is a batch tier or a prompt
cache, and price.

`portability.test.ts` runs **every registered task against three capability profiles** — a
frontier model, a small model with no native PDF, and a minimal one with no native schema
support and no batch tier. A task that quietly depends on one vendor's conveniences fails in CI
rather than on the day of the swap.

**What a swap preserves, provably:** the task contract, the output shape, budget enforcement,
schema validation, batch and cache use where available, cost attribution.

**What a swap does not preserve, and no abstraction can:** how accurately a given model reads a
scanned Chinese test report. That is an empirical property of the model. The golden-set eval is
the gate for a provider change, exactly as it is for a prompt change — which is why the second
adapter is scheduled for the week the eval can score it (`decisions.md` D-014), not before.

So the honest answer to "will it still work flawlessly on Gemini?" is: **the system will run
unchanged and correctly; whether it extracts as well is a measurement, not a guarantee, and the
eval is how you take it.**

### Adding an adapter

Create `src/providers/<vendor>.ts` implementing `Provider` — three methods: `capabilities`,
`estimateInputTokens`, `generate`. It is the only file permitted to import that vendor's SDK.
Nothing else changes: model ids live in `GatewayConfig.models`, keyed by role.

```ts
const gateway = new Gateway({
  provider: new WhicheverProvider(process.env.API_KEY),
  models: { classify: "…", extract: "…" },   // configuration, never literals in feature code
  usage: usageSink,
  imageTokensPerPage: 1_900,
});
```

Read the current model ids, prices and API shapes from the vendor's live documentation when you
write the adapter. Do not carry them over from memory or from the technical plan — see
`tabeen_CLAUDE.md`.

**No adapter exists yet, deliberately.** The seam and its tests are what needed to exist before
any feature code could leak a vendor into itself.

## Spending less

Token cost is designed down in four places, in descending order of effect:

1. **Not calling.** `classify_document` matches phrases over the filename and PDF text layer in
   EN/DE/FR/ZH. Most compliance documents announce what they are on page one, so most
   classifications cost nothing and are reproducible — which also makes them auditable, a
   property the model call does not have.
2. **Sending less.** `prepareInput` sends the text layer instead of page images where one
   exists (hundreds of tokens instead of thousands), two pages instead of twelve, and reports
   what it left out.
3. **The budget.** A declared ceiling per task, checked before the request goes out. A silent
   overspend is otherwise discovered on the invoice.
4. **The batch tier**, requested for non-urgent work where the provider offers one.

Every call is recorded against an organisation with its provider, model, prompt version, tokens
and cost, so cost per customer is measured from the first call rather than reconstructed later.
Calls resolved deterministically are recorded too, with zero cost — the saving should be visible,
not invisible.
