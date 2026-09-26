/**
 * Unsubscribe tokens, deriving rather than storing (`05-interim-waitlist-plan.md` §3.2). The
 * token is `HMAC-SHA256(secret, email)`: recomputing it needs only the email and the secret, so
 * nothing about it has to be persisted or looked up — an unsubscribe link stays valid for as
 * long as the address is on the list and the secret hasn't rotated.
 *
 * Uses the Web Crypto API (`crypto.subtle`), not `node:crypto`. Unlike
 * `@cfm/supplier-request`'s magic-link tokens, this needs no split into a Node-only entry point
 * at all: `crypto.subtle` is standard, available in Node (18+), every modern browser, and the
 * Cloudflare Workers runtime that `apps/scanner/functions` deploys to. Reach for `node:crypto`
 * only where a capability truly has no Web Crypto equivalent (@cfm/supplier-request's
 * `randomBytes` for raw token generation is exactly that case, since Web Crypto's
 * `getRandomValues` is the Node equivalent there too — but HMAC has a direct match, so there's
 * no reason to trade portability away).
 */

const encoder = new TextEncoder();

// No explicit CryptoKey return-type annotation: that name is a global *value* (a constructor),
// not a type, unless the "DOM" lib is loaded — and pulling DOM types into a package with no
// browser DOM dependency would be a stranger workaround than just letting inference do this.
async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function deriveUnsubscribeToken(secret: string, email: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(email));
  return toHex(signature);
}

/**
 * Constant-time comparison of two equal-length hex strings. Not `===`, so a guessed token can't
 * be narrowed down one character at a time by measuring response time — same reasoning as
 * `@cfm/supplier-request/node`'s `verifyMagicLinkToken`, just without `node:crypto`'s
 * `timingSafeEqual` available to lean on.
 */
export async function verifyUnsubscribeToken(secret: string, email: string, token: string): Promise<boolean> {
  const expected = await deriveUnsubscribeToken(secret, email);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
