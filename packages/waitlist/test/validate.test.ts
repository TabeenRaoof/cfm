import { describe, expect, it } from "vitest";
import { validateSubscription } from "../src/validate.ts";

const CONTEXT = { now: "2026-09-25T12:00:00Z", consentTextVersion: "v1" };

function input(overrides: Partial<Record<"email" | "skuCount" | "consent" | "honeypot", unknown>> = {}) {
  return {
    email: "seller@example.com",
    skuCount: "80",
    consent: "on",
    honeypot: "",
    ...overrides,
  };
}

describe("validateSubscription — happy path", () => {
  it("accepts a well-formed submission and normalises the email", () => {
    const result = validateSubscription(input({ email: "  Seller@Example.COM  " }), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.subscription.email).toBe("seller@example.com");
    expect(result.subscription.consentedAt).toBe(CONTEXT.now);
    expect(result.subscription.consentTextVersion).toBe("v1");
    expect(result.subscription.source).toBe("waitlist");
  });

  it("accepts a submission with no sku count given", () => {
    const result = validateSubscription(input({ skuCount: "" }), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.subscription.skuCount).toBeNull();
  });

  it("truncates an oversized sku_count rather than rejecting the whole submission", () => {
    const result = validateSubscription(input({ skuCount: "a".repeat(50) }), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.subscription.skuCount).toHaveLength(20);
  });
});

describe("validateSubscription — the honeypot", () => {
  it("rejects silently (from the caller's perspective) when the hidden field is filled", () => {
    const result = validateSubscription(input({ honeypot: "http://spam.example" }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "honeypot_filled" });
  });

  it("checks the honeypot before consent or email, so a bot never learns which check it failed", () => {
    const result = validateSubscription(
      input({ email: "not-an-email", consent: "", honeypot: "filled" }),
      CONTEXT,
    );
    expect(result).toEqual({ ok: false, reason: "honeypot_filled" });
  });

  it("passes an empty honeypot through", () => {
    const result = validateSubscription(input({ honeypot: "" }), CONTEXT);
    expect(result.ok).toBe(true);
  });

  it("treats a honeypot of only whitespace as unfilled — a real human never types just spaces there", () => {
    const result = validateSubscription(input({ honeypot: "   " }), CONTEXT);
    expect(result.ok).toBe(true);
  });
});

describe("validateSubscription — consent", () => {
  it("rejects a missing consent field — the browser's required attribute is not trusted", () => {
    const result = validateSubscription(input({ consent: undefined }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "missing_consent" });
  });

  it("rejects an empty-string consent field", () => {
    const result = validateSubscription(input({ consent: "" }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "missing_consent" });
  });
});

describe("validateSubscription — email", () => {
  it("rejects a non-string email", () => {
    const result = validateSubscription(input({ email: undefined }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("rejects an email with no @ or no domain dot", () => {
    expect(validateSubscription(input({ email: "not-an-email" }), CONTEXT)).toEqual({
      ok: false,
      reason: "invalid_email",
    });
    expect(validateSubscription(input({ email: "seller@example" }), CONTEXT)).toEqual({
      ok: false,
      reason: "invalid_email",
    });
  });

  it("rejects an email over the length cap", () => {
    const longEmail = `${"a".repeat(250)}@example.com`; // > 254 chars total
    const result = validateSubscription(input({ email: longEmail }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("rejects an all-whitespace email rather than accepting an empty address", () => {
    const result = validateSubscription(input({ email: "   " }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "invalid_email" });
  });
});
