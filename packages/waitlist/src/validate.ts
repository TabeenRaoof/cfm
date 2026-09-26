/**
 * Validates one waitlist submission (`05-interim-waitlist-plan.md` §3.2). Pure and deterministic
 * — no I/O, no model call, nothing to get wrong that a regex and a length check can't catch.
 *
 * What this does NOT decide: whether the email is already on the list (a store concern — see
 * store.ts, which is idempotent on purpose) or whether the request as a whole is too large (an
 * HTTP-layer concern the caller checks before this ever runs).
 */

export interface RawSubscriptionInput {
  /** Whatever the form field decoded to — validated here, not trusted beforehand. */
  readonly email: unknown;
  readonly skuCount: unknown;
  readonly consent: unknown;
  /** The hidden field. Any non-empty value means a bot filled in every field, including this one. */
  readonly honeypot: unknown;
}

export interface ValidSubscription {
  readonly email: string; // trimmed, lowercased
  readonly skuCount: string | null;
  readonly consentedAt: string;
  readonly consentTextVersion: string;
  readonly source: "waitlist";
}

export type SubscriptionRejectionReason = "honeypot_filled" | "missing_consent" | "invalid_email";

export type SubscriptionResult =
  | { readonly ok: true; readonly subscription: ValidSubscription }
  | { readonly ok: false; readonly reason: SubscriptionRejectionReason };

const MAX_EMAIL_LENGTH = 254; // RFC 5321 §4.5.3.1.3
const MAX_SKU_COUNT_LENGTH = 20;
// Deliberately simple: syntax only, no MX lookup, no attempt to be RFC 5322-complete. A false
// negative here just means a real signup gets an honest "check the email" retry; a false
// positive can't happen from being too strict, so strict is the safe direction.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `now` and `consentTextVersion` are passed in rather than read internally (a clock, a "current
 * wording" constant) so a test can assert an exact stored value instead of a moving target —
 * same discipline as `@cfm/documents`' `validateIssueDate` and `@cfm/supplier-request`'s `asOf`.
 */
export function validateSubscription(
  input: RawSubscriptionInput,
  context: { readonly now: string; readonly consentTextVersion: string },
): SubscriptionResult {
  // Checked first and deliberately given no distinguishing response later: a bot that fills
  // every field, including the one no human sees, gets exactly the response a real signup gets.
  if (typeof input.honeypot === "string" && input.honeypot.trim() !== "") {
    return { ok: false, reason: "honeypot_filled" };
  }

  // The browser's `required` attribute is not a guarantee — this is the actual check.
  if (typeof input.consent !== "string" || input.consent.trim() === "") {
    return { ok: false, reason: "missing_consent" };
  }

  if (typeof input.email !== "string") return { ok: false, reason: "invalid_email" };
  const email = input.email.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: "invalid_email" };
  }

  const skuCount =
    typeof input.skuCount === "string" && input.skuCount.trim() !== ""
      ? input.skuCount.trim().slice(0, MAX_SKU_COUNT_LENGTH)
      : null;

  return {
    ok: true,
    subscription: {
      email,
      skuCount,
      consentedAt: context.now,
      consentTextVersion: context.consentTextVersion,
      source: "waitlist",
    },
  };
}
