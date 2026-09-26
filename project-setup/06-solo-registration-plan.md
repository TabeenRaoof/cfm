# 06 · Solo registration: staged so nothing happens before it's authorized

**Status:** Plan · **Written:** 26 September 2026, updated same day · **Decision:** D-046
**Trigger:** Tabeen's actual approved EAD start date — **not** a calendar date picked in advance.
Form I-765 has now been filed, requesting a start date of **4 January 2027**. Treat that date as
requested, not confirmed: Tabeen's own words, "it might not get approved by then." `01-` §9's
"12 December 2026" was the original plan's assumption and is now superseded by this filing — the
frozen `01-`/`02-` text is not edited (D-011); this file and `decisions.md` carry the correction.

## 0. The one fact this whole plan depends on

Form I-765 is filed, with a requested start of 4 January 2027 — six weeks later than `01-`'s
original assumption. This still isn't a confirmed trigger:

- USCIS can approve with a different (later) start date than requested, and processing time
  varies — this is exactly why Tabeen flagged it might not be approved by 4 January.
- The real trigger for everything in this plan is **the start date printed on the approved EAD
  card**, whenever that turns out to be — not 4 January, and not 12 December.
- **A consequence worth naming plainly:** the current Gate 3 is D-025's revision — **5 paying
  customers by 28 February 2027** (it superseded `01-` §10's original "≥8 by 31 January"). It was
  sized on a 12 December billing-enable date, ~11 weeks of runway. At a 4 January start that's ~8
  weeks; if approval lands later, less. Gate 3's date isn't changed here, but the slack behind it
  is smaller — worth having design partners primed to convert immediately once billing can
  legally turn on, rather than starting outreach from zero on day one of authorization.

Nothing below should be scheduled against any specific calendar date until the EAD is approved.

## 1. What's already safe today, unchanged

Per `01-` §9 and the discussion this session: research, interviews, prototyping, and unpaid
design-partner testing. This covers everything currently live — the free scanner, the waitlist,
catalog work, Gate 1 interviews. None of it changes because of this plan.

## 2. Prep work — safe to do *now*, because none of it is incorporating, invoicing, or accepting payment

Doing this now means the actual trigger date is a single afternoon of filing, not a scramble.

- **Decide the city/state of operation** — whichever US city Tabeen will actually be based in
  when OPT starts. This gates the business-licence research below and isn't recorded anywhere
  in this repo yet.
- **Research that city's business licence requirements** (cost, form, turnaround time) so the
  actual filing is copy-and-submit, not research-and-submit.
- **Confirm sole-proprietorship + EIN + city-licence is still the DSO's and immigration
  attorney's read** for OPT documentation purposes — `01-` §8.3 recommends this over an LLC, but
  that recommendation is from the original plan review, not a fresh attorney confirmation.
- **Ask the DSO/attorney directly whether the EIN application itself can be filed before the OPT
  start date.** An EIN is a free, instant IRS.gov application and arguably isn't "conducting
  business" — but this project's own discipline says never guess on an immigration line. Get
  this answered explicitly rather than assumed either way.
- **Keep the free scanner + waitlist running and building traction** — every signup and scan
  between now and the trigger date is evidence for Gate 3, at zero legal risk.
- **Continue the Q-6b trademark/domain search** for "Attesta Compliance" — naming has no bearing
  on work authorization and can (and should, given the 30 September self-imposed deadline)
  proceed on its own timeline.

## 3. The day-of checklist — only once the EAD start date has actually arrived

Everything here waits for the confirmed trigger from §0, not the calendar.

1. File the EIN (if not already confirmed safe to do in §2, do it now — instant, free, at
   irs.gov directly; never pay a third-party site for this).
2. File the city business licence researched in §2.
3. Open a business bank account under the sole proprietorship (most banks accept EIN + licence).
4. Turn on the merchant-of-record (Paddle or similar per `02-` — handles EU/UK VAT on SaaS
   automatically) using the new EIN/business details.
5. Update the scanner's `CONTROLLER_NAME`/`CONTROLLER_ADDRESS` build variables to the real
   registered business identity (name and address may differ from "Tabeen Raoof" once a sole
   proprietorship/DBA exists) and redeploy.
6. Re-check whether the UK ICO data-protection-fee question (raised earlier this session,
   unresolved) applies once there's an actual registered entity behind the controller identity.
7. Begin Gate 3 per `01-`: enable billing, start converting design partners.
8. Log the actual registration date, entity details, and EIN-issuance date in `decisions.md` —
   this is the kind of fact that should never live only in memory or a single conversation.

## 4. What stays explicitly out of scope until the trigger

Incorporating, invoicing, accepting any payment, and (per the EIN question in §2, pending
confirmation) possibly the EIN application itself. If in doubt about any specific action not
listed here, the standing rule from this session holds: ask the DSO or the immigration attorney
before doing it, not after.
