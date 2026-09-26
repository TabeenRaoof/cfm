/**
 * GET/POST /api/unsubscribe — `05-interim-waitlist-plan.md` §3.1. GET shows a confirmation page
 * rather than deleting on the spot, because mail clients and link scanners prefetch GET links;
 * only the POST a human actually submits removes anything. Both re-verify the token — the GET
 * step is not trusted by the POST step, since a confirmation page is just HTML, not proof.
 *
 * The token itself needs no lookup: `verifyUnsubscribeToken` recomputes it from the email and
 * the secret (`@cfm/waitlist`'s `deriveUnsubscribeToken`), so nothing about it had to be stored
 * when the digest was sent.
 */

import { verifyUnsubscribeToken } from "@cfm/waitlist";
import type { Env } from "../lib/env.ts";
import { field, htmlResponse, readFormBody, redirectTo, textResponse } from "../lib/http.ts";
import { D1Store } from "../lib/store.ts";

const INVALID_LINK_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Link not valid</title></head><body>
<p>This unsubscribe link is not valid, or the address has already been removed.
Write to us if you're still receiving emails you don't want.</p>
</body></html>`;

function confirmPage(email: string, token: string): string {
  const safeEmail = email.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Unsubscribe</title></head><body>
<p>Unsubscribe <strong>${safeEmail}</strong> from the compliance-change digest?</p>
<form method="post" action="/api/unsubscribe">
  <input type="hidden" name="email" value="${safeEmail}">
  <input type="hidden" name="token" value="${token}">
  <button type="submit">Yes, unsubscribe me</button>
</form>
</body></html>`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("t");
  if (!email || !token || !(await verifyUnsubscribeToken(context.env.UNSUB_SECRET, email, token))) {
    return htmlResponse(INVALID_LINK_PAGE, 400);
  }
  return htmlResponse(confirmPage(email, token));
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const params = await readFormBody(context.request);
  if (params === null) return textResponse("Payload too large.", 413);

  const email = field(params, "email");
  const token = field(params, "token");
  if (typeof email !== "string" || typeof token !== "string") {
    return htmlResponse(INVALID_LINK_PAGE, 400);
  }
  if (!(await verifyUnsubscribeToken(context.env.UNSUB_SECRET, email, token))) {
    return htmlResponse(INVALID_LINK_PAGE, 400);
  }

  await new D1Store(context.env.DB).removeByEmail(email.trim().toLowerCase());
  // "removed" and "not_found" get the same redirect — nothing here should let a caller probe
  // whether a given address was ever on the list.
  return redirectTo("/unsubscribed.html");
};
