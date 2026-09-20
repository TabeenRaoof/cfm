/**
 * Node-only: magic-link token generation and verification. Split out for the same reason as
 * @cfm/catalog's and @cfm/channels' node.ts (decisions.md D-022) — everything else in this
 * package is pure and could run in a browser (e.g. rendering a preview of the email before
 * sending), and one `node:crypto` import in the index would quietly make that impossible.
 *
 * The raw token exists only in the emailed link. What gets stored on the `supplier_request` row
 * is `tokenHash` — if the database ever leaked, a stolen hash cannot be turned back into a
 * working link. Verifying uses a timing-safe comparison so response time can't leak how many
 * hash bytes matched.
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export interface GeneratedToken {
  /** Goes into the emailed link. Never stored anywhere. */
  readonly token: string;
  /** Goes into supplier_request.token_hash. */
  readonly tokenHash: string;
}

export function generateMagicLinkToken(): GeneratedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * True only if `token` hashes to exactly `tokenHash`. Uses a timing-safe comparison rather than
 * `===` on the hex strings, so a mistyped or guessed token can't be narrowed down one character
 * at a time by measuring response time.
 */
export function verifyMagicLinkToken(token: string, tokenHash: string): boolean {
  const candidate = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function buildMagicLinkUrl(baseUrl: string, requestId: string, token: string): string {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/$/, "") + "/supplier-upload";
  url.searchParams.set("request", requestId);
  url.searchParams.set("token", token);
  return url.toString();
}
