import { describe, expect, it } from "vitest";
import { deriveUnsubscribeToken, verifyUnsubscribeToken } from "../src/token.ts";

describe("deriveUnsubscribeToken", () => {
  it("is deterministic for the same secret and email", async () => {
    const a = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    const b = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("differs for a different email under the same secret", async () => {
    const a = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    const b = await deriveUnsubscribeToken("s3cr3t", "other@example.com");
    expect(a).not.toBe(b);
  });

  it("differs for a different secret with the same email — a rotated secret invalidates old links", async () => {
    const a = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    const b = await deriveUnsubscribeToken("different-secret", "seller@example.com");
    expect(a).not.toBe(b);
  });
});

describe("verifyUnsubscribeToken", () => {
  it("accepts a token derived with the matching secret and email", async () => {
    const token = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    expect(await verifyUnsubscribeToken("s3cr3t", "seller@example.com", token)).toBe(true);
  });

  it("rejects a token for a different email", async () => {
    const token = await deriveUnsubscribeToken("s3cr3t", "seller@example.com");
    expect(await verifyUnsubscribeToken("s3cr3t", "someone-else@example.com", token)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await deriveUnsubscribeToken("wrong-secret", "seller@example.com");
    expect(await verifyUnsubscribeToken("s3cr3t", "seller@example.com", token)).toBe(false);
  });

  it("fails closed rather than throwing on a garbage or empty token", async () => {
    await expect(verifyUnsubscribeToken("s3cr3t", "seller@example.com", "not-hex")).resolves.toBe(false);
    await expect(verifyUnsubscribeToken("s3cr3t", "seller@example.com", "")).resolves.toBe(false);
  });
});
