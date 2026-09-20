import { describe, expect, it } from "vitest";
import type { SupplierRequest } from "../src/request.ts";
import { REMINDER_OFFSETS_DAYS, dueReminder, recordReminderSent } from "../src/reminders.ts";

// Built directly rather than through markSent: some tests override status to a terminal value,
// and markSent correctly refuses to touch a request that's already terminal.
function sentRequest(overrides: Partial<SupplierRequest> = {}): SupplierRequest {
  return {
    id: "req_1",
    productIds: ["prod_1"],
    partyId: "party_1",
    requestedItems: [{ key: "rp_mandate", label: "RP mandate", fulfilledAt: null }],
    tokenHash: "a".repeat(64),
    createdAt: "2026-09-01T00:00:00Z",
    sentAt: "2026-09-01T00:00:00Z",
    openedAt: null,
    dueAt: "2026-09-15T00:00:00Z",
    status: "sent",
    remindersSent: [],
    cancelledAt: null,
    ...overrides,
  };
}

describe("dueReminder", () => {
  it("sends nothing while still well before the first offset", () => {
    const request = sentRequest();
    expect(dueReminder(request, "2026-09-05T00:00:00Z")).toBeNull(); // 10 days out
  });

  it("fires the first reminder once inside the 7-day offset", () => {
    const request = sentRequest();
    expect(dueReminder(request, "2026-09-08T00:00:00Z")).toBe(0); // 7 days out
  });

  it("does not re-fire the same reminder once it has been recorded", () => {
    let request = sentRequest();
    expect(dueReminder(request, "2026-09-08T00:00:00Z")).toBe(0);
    request = recordReminderSent(request, "2026-09-08T00:00:00Z");
    expect(dueReminder(request, "2026-09-08T00:00:01Z")).toBeNull();
  });

  it("catches up on the earliest missed reminder rather than skipping to the latest", () => {
    // No reminder has been sent yet, and we're already only 1 day from due — the 7- and 3-day
    // windows passed with the cron not having run. The next index owed is still 0, so the
    // supplier gets the first nudge now rather than jumping straight to the final warning.
    const request = sentRequest();
    expect(dueReminder(request, "2026-09-14T00:00:00Z")).toBe(0);
  });

  it("advances through the schedule as reminders are recorded", () => {
    let request = sentRequest();
    request = recordReminderSent(request, "2026-09-08T00:00:00Z"); // index 0 done
    expect(dueReminder(request, "2026-09-12T00:00:00Z")).toBe(1); // 3 days out, index 1 due
    request = recordReminderSent(request, "2026-09-12T00:00:00Z");
    expect(dueReminder(request, "2026-09-14T00:00:00Z")).toBe(2); // 1 day out, index 2 due
  });

  it("sends no more once the schedule is exhausted", () => {
    let request = sentRequest();
    for (const offsetDay of [8, 12, 14]) {
      request = recordReminderSent(request, `2026-09-${offsetDay}T00:00:00Z`);
    }
    expect(request.remindersSent).toHaveLength(REMINDER_OFFSETS_DAYS.length);
    expect(dueReminder(request, "2026-09-14T12:00:00Z")).toBeNull();
  });

  it("never reminds a draft request — nothing was sent to remind about", () => {
    const request = sentRequest({ status: "draft", sentAt: null });
    expect(dueReminder(request, "2026-09-14T00:00:00Z")).toBeNull();
  });

  it("never reminds a cancelled or fulfilled request", () => {
    const cancelled = sentRequest({ status: "cancelled", cancelledAt: "2026-09-05T00:00:00Z" });
    expect(dueReminder(cancelled, "2026-09-14T00:00:00Z")).toBeNull();
    const fulfilled = sentRequest({
      status: "fulfilled",
      requestedItems: [{ key: "rp_mandate", label: "RP mandate", fulfilledAt: "2026-09-05T00:00:00Z" }],
    });
    expect(dueReminder(fulfilled, "2026-09-14T00:00:00Z")).toBeNull();
  });
});
