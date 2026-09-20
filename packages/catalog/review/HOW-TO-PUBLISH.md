# How to publish a requirement

About 15 minutes each. Four of them is one sitting.

## Once, before you start

Nothing to install. Every command below runs on the Node you already have.

```bash
npm run catalog:status      # what is published, what is drafted, what has a packet
```

## Per requirement

**1 · Read the packet.** `packages/catalog/review/<id>.md`. It sets what our JSON claims beside
what the source says, and flags what needs your eye with ❗ and ❓. Five minutes.

**2 · Open the source and confirm it.** The packet links it. You are checking one thing: does
the passage really say what we claim? For the GPSR ones this means opening EUR-Lex and finding
the article. Five minutes, and it is the only irreplaceable step — everything else here is
bookkeeping.

**3 · Apply any content corrections the packet recommends.** These are edits to the requirement
itself — a tightened `article_ref`, an extra `required_data` entry. Edit the JSON, or tell me
which ones you accepted and I will. Skipping them is fine; the requirement is still publishable.

**4 · Publish.**

```bash
npm run catalog:publish -- eu.gpsr.technical-documentation \
  --reviewer TR --confidence high --read 0
```

That writes `state`, `reviewer`, `last_reviewed_at`, `confidence` and marks the source you read
as verified, then appends a row to `sources.md`. It re-runs the catalog gate first and refuses
if the result would not pass.

`--read 0` is you asserting you opened source 0. Nothing else sets `verified: true`, and no
command can set it on your behalf.

**Confidence:** `high` you read it and it is unambiguous · `medium` you read it and mapping it
to our wording took judgement · `low` is refused, because a requirement you are unsure of should
stay a draft. **`medium` is publishable and normal** — the product shows the confidence and the
citation next to every requirement, so a seller can check you.

## Then

```bash
npm run catalog:check       # the gate
npm run catalog:status      # the board
```

Once all four are published, a production scanner build will run for the first time:

```bash
CONTROLLER_NAME="…" CONTROLLER_ADDRESS="…" CONTACT_EMAIL="…" \
WAITLIST_ACTION="…" npm run scanner:build
```

## The four, in order

| | Requirement | Confidence drafted at | The packet's open question |
|---|---|---|---|
| 1 | `eu.gpsr.responsible-economic-operator` | high | Art. 16 confirmed. Our condition is a false positive for EU-established importers — safe, worth a follow-up |
| 2 | `eu.gpsr.manufacturer-identification` | high | Should be **Art. 9(6)**, and we are **missing** the electronic address field |
| 3 | `eu.gpsr.technical-documentation` | high | Cite **Art. 9(3)** too — that is where the 10 years lives. Is "Annex" right? |
| 4 | `de.epr.packaging-lucid` | medium | Does the duty cover all packaging, or only consumer-facing? The one thing I would check before publishing |

Numbers 2 and 3 are the quickest — one article each, no conditions to reason about.
