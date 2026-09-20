import { describe, expect, it } from "vitest";
import {
  buildMagicLinkUrl,
  generateMagicLinkToken,
  hashToken,
  verifyMagicLinkToken,
} from "../src/node.ts";

describe("magic-link tokens", () => {
  it("generates a token whose hash matches what verify expects", () => {
    const { token, tokenHash } = generateMagicLinkToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(verifyMagicLinkToken(token, tokenHash)).toBe(true);
  });

  it("never repeats a token across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateMagicLinkToken().token);
    expect(seen.size).toBe(200);
  });

  it("rejects a wrong token against a real hash", () => {
    const { tokenHash } = generateMagicLinkToken();
    const wrong = generateMagicLinkToken().token;
    expect(verifyMagicLinkToken(wrong, tokenHash)).toBe(false);
  });

  it("rejects a token that is merely a prefix or suffix of the real one", () => {
    const { token, tokenHash } = generateMagicLinkToken();
    expect(verifyMagicLinkToken(token.slice(0, -1), tokenHash)).toBe(false);
    expect(verifyMagicLinkToken(token + "x", tokenHash)).toBe(false);
  });

  it("never stores the raw token — only its hash is meant to persist", () => {
    const { token, tokenHash } = generateMagicLinkToken();
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });
});

describe("buildMagicLinkUrl", () => {
  it("carries the request id and raw token as query parameters", () => {
    const url = buildMagicLinkUrl("https://app.example.com", "req_123", "tok_abc");
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/supplier-upload");
    expect(parsed.searchParams.get("request")).toBe("req_123");
    expect(parsed.searchParams.get("token")).toBe("tok_abc");
  });

  it("does not duplicate a trailing slash on the base URL", () => {
    const url = buildMagicLinkUrl("https://app.example.com/", "req_1", "t");
    expect(new URL(url).pathname).toBe("/supplier-upload");
  });
});
