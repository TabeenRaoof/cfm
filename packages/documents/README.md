# @cfm/documents

The deterministic half of the document pipeline: what the fields are, what can be found without
a model, what counts as valid, and whether an extraction may be accepted without a human.

No model is called from this package. `@cfm/ai`'s `extract_document` task is what wires it to
one, and it does so by asking this package first.

## One declaration, three derivations

A field is declared once in `schemas.ts` and three things come from that declaration rather
than being written three times: the JSON Schema a model is asked to fill, the validators that
check whatever comes back, and the review card a human sees. Written separately they drift —
the schema says a date is optional, the validator insists on it, the review UI asks for
something neither mentions.

## Deterministic first, at the field level

Compliance documents are formulaic. A labelled date, a report number beside "Report No.", a
standard reference with a published shape — a regex finds these, costs nothing, gives the same
answer every time, and can be shown to an auditor. A model call does none of those.

The saving is not a shorter prompt; it is **fewer questions**. `remainingJsonSchema` narrows the
schema to what the patterns could not answer, so a resolved field is not asked for at all.

Two rules keep it honest:

- **`verified: false` means the format was inferred, not confirmed.** An unverified pattern
  yields a *candidate*: recorded, useful, never auto-accepted. The LUCID pattern is one — the
  digit count was not confirmed against the ZSVR's specification.
- **A pattern matching twice does not choose.** Two plausible issue dates is exactly when a
  human should look, and picking the first would be free and wrong.

### The separator carries information

`14.03.2026` is European convention and reads as day-first. `03/04/2026` is 3 April in Europe
and 4 March in the US — so it is declined, not guessed. That is a heuristic about convention,
which is why the ambiguous case returns null rather than a best guess.

## The confidence gate

`gateExtraction` decides accept or review. Entirely deterministic: **no model scores its own
work**, because a self-reported confidence is the one number a model cannot calibrate, and
using it as a gate would let the same component decide both the answer and whether the answer
is good enough.

Acceptance requires all of — every required field present; every validator that could judge
saying valid; nothing from an unconfirmed pattern; nothing ambiguous. Anything else is a review
card with a reason per problem.

This errs towards human time deliberately. An extraction accepted wrongly becomes evidence
behind a green cell, and the whole product rests on a green cell meaning something.

## What the validators catch

A report dated after today. An expiry before its issue date. A date that is not a real calendar
date — `2026-02-30` matches the pattern and `Date.parse` rolls it silently to 2 March. A country
name where a code belongs. A standard reference that does not parse.

Each is a sign the document is wrong, misread, or fabricated, and each is cheaper to catch here
than in front of a customer.

**`undetermined` is not `valid`.** A field no rule could check does not block acceptance, but it
is never recorded as having passed one.
