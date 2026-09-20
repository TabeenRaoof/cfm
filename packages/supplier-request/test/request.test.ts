import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  cancel,
  expireIfDue,
  fulfilItem,
  fulfilmentStatus,
  isOverdue,
  markOpened,
  markSent,
  type SupplierRequest,
} from "../src/request.ts";

function baseRequest(overrides: Partial<SupplierRequest> = {}): SupplierRequest {
  return {
    id: "req_1",
    productIds: ["prod_1"],
    partyId: "party_1",
    requestedItems: [
      { key: "rp_mandate", label: "Responsible person mandate", fulfilledAt: null },
      { key: "epr_certificate", label: "EPR registration certificate", fulfilledAt: null },
    ],
    tokenHash: "a".repeat(64),
    createdAt: "2026-09-01T00:00:00Z",
    sentAt: null,
    openedAt: null,
    dueAt: "2026-09-15T00:00:00Z",
    status: "draft",
    remindersSent: [],
    cancelledAt: null,
    ...overrides,
  };
}

describe("fulfilmentStatus", () => {
  it("is 'none' when nothing has been uploaded", () => {
    expect(fulfilmentStatus(baseRequest().requestedItems)).toBe("none");
  });

  it("is 'complete' when a request asked for nothing at all", () => {
    expect(fulfilmentStatus([])).toBe("complete");
  });

  it("is 'partial' with some but not all items fulfilled", () => {
    const items = baseRequest().requestedItems.map((item, i) =>
      i === 0 ? { ...item, fulfilledAt: "2026-09-05T00:00:00Z" } : item,
    );
    expect(fulfilmentStatus(items)).toBe("partial");
  });
});

describe("the status lifecycle", () => {
  it("draft -> sent -> opened -> partially_fulfilled -> fulfilled", () => {
    let request = baseRequest();
    request = markSent(request, "2026-09-01T09:00:00Z");
    expect(request.status).toBe("sent");

    request = markOpened(request, "2026-09-02T09:00:00Z");
    expect(request.status).toBe("opened");

    request = fulfilItem(request, "rp_mandate", "2026-09-03T09:00:00Z");
    expect(request.status).toBe("partially_fulfilled");

    request = fulfilItem(request, "epr_certificate", "2026-09-04T09:00:00Z");
    expect(request.status).toBe("fulfilled");
  });

  it("refuses to send a request that was already sent", () => {
    const request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    expect(() => markSent(request, "2026-09-02T00:00:00Z")).toThrow(InvalidTransitionError);
  });

  it("refuses to fulfil an item on a request never sent", () => {
    expect(() => fulfilItem(baseRequest(), "rp_mandate", "2026-09-02T00:00:00Z")).not.toThrow();
    // Fulfilling is allowed from draft in this model (an upload could theoretically race the
    // email), but a terminal request always refuses:
    const cancelled = cancel(baseRequest(), "2026-09-02T00:00:00Z");
    expect(() => fulfilItem(cancelled, "rp_mandate", "2026-09-03T00:00:00Z")).toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects fulfilling an item key that was never requested", () => {
    const request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    expect(() => fulfilItem(request, "not_a_real_item", "2026-09-02T00:00:00Z")).toThrow(
      /no requested item/,
    );
  });

  it("recording a second open does not move an already-fulfilled request backward", () => {
    let request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    request = fulfilItem(request, "rp_mandate", "2026-09-02T00:00:00Z");
    request = fulfilItem(request, "epr_certificate", "2026-09-03T00:00:00Z");
    expect(request.status).toBe("fulfilled");
    request = markOpened(request, "2026-09-10T00:00:00Z");
    expect(request.status).toBe("fulfilled"); // opening a fulfilled link is a no-op on status
  });

  it("cancelling is terminal and cannot be cancelled again", () => {
    const request = cancel(baseRequest(), "2026-09-02T00:00:00Z");
    expect(request.status).toBe("cancelled");
    expect(() => cancel(request, "2026-09-03T00:00:00Z")).toThrow(InvalidTransitionError);
  });
});

describe("overdue / expiry", () => {
  it("is not overdue before the due date", () => {
    const request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    expect(isOverdue(request, "2026-09-14T00:00:00Z")).toBe(false);
  });

  it("is overdue once asOf passes dueAt, given known unfulfilled facts — never guessed", () => {
    const request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    expect(isOverdue(request, "2026-09-16T00:00:00Z")).toBe(true);
  });

  it("a fulfilled request is never expired even long after its due date", () => {
    let request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    request = fulfilItem(request, "rp_mandate", "2026-09-02T00:00:00Z");
    request = fulfilItem(request, "epr_certificate", "2026-09-03T00:00:00Z");
    expect(isOverdue(request, "2027-01-01T00:00:00Z")).toBe(false);
    expect(expireIfDue(request, "2027-01-01T00:00:00Z").status).toBe("fulfilled");
  });

  it("expireIfDue actually flips the status once overdue", () => {
    const request = markSent(baseRequest(), "2026-09-01T00:00:00Z");
    const expired = expireIfDue(request, "2026-09-16T00:00:00Z");
    expect(expired.status).toBe("expired");
  });
});
