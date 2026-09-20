# @cfm/catalog

The requirement catalog and its evaluator. This is the moat — not the AI — so it is the most
carefully tested package in the repository and the only one with a publish gate.

Deliberately **dependency-free**. The evaluator runs from a one-off script, a test, or CI with
no install and no build step:

```
node --experimental-strip-types packages/catalog/src/cli/check.ts
```

## What it does

Given what is known about a SKU, a market and optionally a channel, it returns one assessment
per requirement: a status, the citation behind it, and — when it cannot decide — the questions
that would let it.

```ts
const { catalog } = await loadCatalogFromDir("requirements", { version, includeDrafts: false });

assessProduct(catalog, {
  facts: { "manufacturer.country": "CN", "product.has_packaging": true },
  market: { iso_country: "DE" },
  channel: { type: "amazon_de" },
}, { asOf: "2026-09-12" });
```

## The rule that governs everything here

A requirement whose applicability cannot be determined comes back `unknown`, never `na`, and
`unknown` never counts toward market-ready. See `tabeen_AGENTS.md` and `decisions.md` D-002.

Three files carry it: `truth.ts` (three-valued logic), `facts.ts` (the undefined-vs-null
distinction), `evaluate.ts` (the branch that refuses to collapse an undecided applicability).
`test/hard-rule.test.ts` asserts it against every requirement in the repository, including a
monotonicity property: **removing a fact can never make a SKU readier than it was.**

### undefined is not null

```
undefined / key absent  →  we were not told        →  unknown
null                    →  we were told: none      →  a real answer
```

The importer decides which one a blank spreadsheet cell becomes, and the safe direction is
`undefined`. Getting this backwards re-introduces the exact false-green bug the package exists
to prevent, and it will not show up in any test that only uses fully-populated fixtures.

## Writing a requirement

One JSON file per requirement in `requirements/`, named after its `id`.

```json
{
  "id": "eu.gpsr.responsible-economic-operator",
  "state": "draft",
  "applies_when": {
    "all": [
      { "market.jurisdiction": "EU" },
      { "manufacturer.country_in_eu": false }
    ]
  },
  "required_data": [{ "key": "rp.name", "label": "Responsible person name" }],
  "required_evidence": [{ "type": "rp_mandate", "label": "Signed mandate", "expires": true }],
  "sources": [{ "title": "…", "url": "…", "retrieved_at": null, "verified": false }]
}
```

### The condition language

| Form | Meaning |
|---|---|
| `{ "all": [ … ] }` | every branch holds |
| `{ "any": [ … ] }` | at least one branch holds |
| `{ "not": { … } }` | negation — of `unknown`, stays `unknown` |
| `{ "always": true }` | unconditional |
| `{ "product.is_toy": true }` | equality |
| `{ "product.category_code": { "in": ["toys"] } }` | membership |
| `{ "product.gtin": { "exists": true } }` | presence — `null` is false, absent is `unknown` |

Facts the evaluator derives for you, and must not be supplied directly:
`market.iso_country`, `market.jurisdiction`, `channel.type`, `channel.is_marketplace`,
`manufacturer.country_in_eu`, `organisation.established_in_eu`,
`organisation.established_in_market`.

Everything else is a path beginning `product.`, `manufacturer.`, `organisation.`, `market.`,
`channel.`, `rp.` or `packaging.`. A misspelling is rejected at load — otherwise it would
evaluate to `unknown` forever and quietly park every SKU in the gap list, which is invisible
in production precisely because `unknown` is a legitimate outcome.

## The publish gate

**A requirement is `draft` until a named human has read the primary source.** Drafts never reach
a customer. `state: "published"` additionally requires `reviewer`, `last_reviewed_at`, and at
least one source with `verified: true` and a `retrieved_at` date. `npm run catalog:check`
enforces it and fails CI.

An assistant may draft a requirement. It may not promote one. Every entry currently in
`requirements/` is a draft whose article reference was inherited from the technical plan —
which itself says those numbers must be verified against EUR-Lex before publishing.

Record every URL you actually opened, with the date, in `sources.md`.
