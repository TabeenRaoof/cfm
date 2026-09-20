# @cfm/channels

Exports: the seller's compliance data in a form another system will accept.

## Two kinds of export, and the difference matters

**The neutral full export** (`renderFullExport`) needs no template. It is everything we hold per
SKU in our own schema — statuses, the catalog version, the assessment date, and the questions
still outstanding. It cannot be wrong about someone else's file format because it is not
pretending to be one. This is what a seller maps themselves, and what to reach for when a
marketplace changes its template on a Tuesday.

**Channel templates** (`renderChannelExport`) target a specific marketplace's bulk upload. Each
is a JSON data file in `templates/` describing the exact column headers and what fills each.

## Why templates are data, not code

A marketplace's template is their artefact. The headers are not published, they change without
notice, and no amount of cleverness here can derive them. `02-` §8.1 says keep them as versioned
fixtures and re-check monthly, so that is what they are.

**A template is `verified: false` until a human has put it beside the real one.** Exporting an
unverified template throws unless the caller explicitly opts in, because a guess dressed as a
file is worse than no export: the seller uploads it, it is rejected, and concludes the tool does
not work.

| Template | State | To make it real |
|---|---|---|
| `shopify_metafields` | Header format taken from Shopify's own docs (13 Sept 2026); metafield namespace and keys depend on the seller's setup | Run it through a real import, watch the values land, set `verified: true` |
| `amazon_myc` | **Placeholder.** Every header says so. It will be rejected if uploaded as-is | Download the current template from Seller Central → Manage Your Compliance, replace every header with the exact string, set `verified: true` |

## The hard rule reaches here too

This is the last place our data passes before entering a system we do not control and cannot
correct, so the distinction the whole product rests on has to survive it:

| We know | Exports as |
|---|---|
| nothing — never told | **empty cell**, and counted in `blankBecauseUnknown` |
| told there is none | empty cell, not counted as a gap |
| a known negative | `No` |
| a requirement we cannot decide | `Cannot determine - information needed` — never `Not applicable` |

A marketplace reading "No" where we meant "we don't know" is the false green escaped into
someone else's database.

## Entry points

```ts
import { renderChannelExport, renderFullExport } from "@cfm/channels";      // pure
import { loadTemplate, loadTemplates } from "@cfm/channels/node";          // reads templates/
```
