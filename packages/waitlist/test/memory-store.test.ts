import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory-store.ts";
import type { ValidSubscription } from "../src/validate.ts";

function subscription(overrides: Partial<ValidSubscription> = {}): ValidSubscription {
  return {
    email: "seller@example.com",
    skuCount: "80",
    consentedAt: "2026-09-25T12:00:00Z",
    consentTextVersion: "v1",
    source: "waitlist",
    ...overrides,
  };
}

describe("MemoryStore.addSubscriber", () => {
  it("adds a new subscriber", async () => {
    const store = new MemoryStore();
    expect(await store.addSubscriber(subscription())).toBe("added");
    expect(await store.countSubscribers()).toBe(1);
  });

  it("is idempotent — a repeat signup from the same address changes nothing", async () => {
    const store = new MemoryStore();
    await store.addSubscriber(subscription());
    const second = await store.addSubscriber(
      subscription({ skuCount: "999", consentedAt: "2026-10-01T00:00:00Z" }),
    );
    expect(second).toBe("already_subscribed");
    expect(await store.countSubscribers()).toBe(1);
    // The original record is kept, not overwritten by the duplicate attempt.
    const [stored] = await store.listSubscribers();
    expect(stored?.skuCount).toBe("80");
  });
});

describe("MemoryStore.removeByEmail", () => {
  it("removes an existing subscriber", async () => {
    const store = new MemoryStore();
    await store.addSubscriber(subscription());
    expect(await store.removeByEmail("seller@example.com")).toBe("removed");
    expect(await store.countSubscribers()).toBe(0);
  });

  it("reports not_found for an address that was never subscribed", async () => {
    const store = new MemoryStore();
    expect(await store.removeByEmail("nobody@example.com")).toBe("not_found");
  });
});

describe("MemoryStore scan counting", () => {
  it("counts scans per market per day independently", async () => {
    const store = new MemoryStore();
    await store.incrementScan("DE", "2026-09-25");
    await store.incrementScan("DE", "2026-09-25");
    await store.incrementScan("FR", "2026-09-25");
    await store.incrementScan("DE", "2026-09-26");

    const counts = await store.scanCounts();
    expect(counts).toContainEqual({ iso: "DE", day: "2026-09-25", n: 2 });
    expect(counts).toContainEqual({ iso: "FR", day: "2026-09-25", n: 1 });
    expect(counts).toContainEqual({ iso: "DE", day: "2026-09-26", n: 1 });
  });
});
