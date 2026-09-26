/**
 * POST /api/subscribe — `05-interim-waitlist-plan.md` §3.1-3.2. Same-origin target for
 * `waitlist.html`'s form (`WAITLIST_ACTION=/api/subscribe`).
 *
 * Every check here is deterministic; the only branching this route does is on the outcome of
 * `validateSubscription`, which is pure and lives in `@cfm/waitlist` so it's exercised by that
 * package's own unit tests without needing the Workers runtime at all.
 */

import { validateSubscription } from "@cfm/waitlist";
import type { Env } from "../lib/env.ts";
import { field, readFormBody, redirectTo } from "../lib/http.ts";
import { D1Store } from "../lib/store.ts";

const CONSENT_TEXT_VERSION_DEFAULT = "v1";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const params = await readFormBody(context.request);
  if (params === null) {
    return new Response("Payload too large.", { status: 413 });
  }

  const result = validateSubscription(
    {
      email: field(params, "email"),
      skuCount: field(params, "sku_count"),
      consent: field(params, "consent"),
      honeypot: field(params, "company_website"),
    },
    {
      now: new Date().toISOString(),
      consentTextVersion: context.env.CONSENT_TEXT_VERSION ?? CONSENT_TEXT_VERSION_DEFAULT,
    },
  );

  if (!result.ok) {
    // A filled honeypot gets the exact same response as a real signup — the bot never learns
    // which check it failed, or that it failed one at all. A missing consent or bad email is a
    // real person's mistake, so they're sent back to try again rather than told it "worked".
    if (result.reason === "honeypot_filled") return redirectTo("/waitlist-thanks.html");
    return redirectTo(`/waitlist.html?error=${result.reason}`);
  }

  await new D1Store(context.env.DB).addSubscriber(result.subscription);
  // "added" and "already_subscribed" get the same response deliberately — this endpoint cannot
  // be used to test which addresses are already on the list.
  return redirectTo("/waitlist-thanks.html");
};
