/**
 * The supplier_request lifecycle (`02-` §10.1 week 7, table on line 102): a supplier without an
 * account gets a magic link asking for specific documents against specific products, and the
 * status needs to move forward on its own as time and uploads happen — with no model call
 * anywhere in that. Nothing here decides whether an uploaded document is *good*; that is
 * @cfm/documents' job once a file exists. This module only tracks whether the ask itself is
 * still open.
 */

export type SupplierRequestStatus =
  | "draft" // created, link not sent yet
  | "sent" // link emailed, nothing back yet
  | "opened" // supplier followed the link at least once
  | "partially_fulfilled" // some requested items have an upload, not all
  | "fulfilled" // every requested item has an upload
  | "expired" // due_at passed with items still missing
  | "cancelled"; // withdrawn by the requester before completion

export interface RequestedItem {
  readonly key: string;
  readonly label: string;
  /** Set once a document has been uploaded and linked against this item. Never guessed. */
  readonly fulfilledAt: string | null;
}

export interface SupplierRequest {
  readonly id: string;
  readonly productIds: readonly string[];
  readonly partyId: string;
  readonly requestedItems: readonly RequestedItem[];
  /** Only a hash is ever stored — see node.ts. The raw token exists only in the emailed link. */
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly sentAt: string | null;
  readonly openedAt: string | null;
  readonly dueAt: string;
  readonly status: SupplierRequestStatus;
  /** ISO timestamps of reminders actually sent, in order — the record reminders.ts reads. */
  readonly remindersSent: readonly string[];
  readonly cancelledAt: string | null;
}

const TERMINAL_STATUSES: ReadonlySet<SupplierRequestStatus> = new Set([
  "fulfilled",
  "expired",
  "cancelled",
]);

export function isTerminal(status: SupplierRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Derives fulfilment status from the items alone — never trusts a stored status to stay correct. */
export function fulfilmentStatus(
  items: readonly RequestedItem[],
): "none" | "partial" | "complete" {
  if (items.length === 0) return "complete"; // nothing was ever asked for
  const fulfilledCount = items.filter((i) => i.fulfilledAt !== null).length;
  if (fulfilledCount === 0) return "none";
  if (fulfilledCount === items.length) return "complete";
  return "partial";
}

export class InvalidTransitionError extends Error {
  constructor(from: SupplierRequestStatus, action: string) {
    super(`Cannot ${action} a supplier request in status "${from}".`);
    this.name = "InvalidTransitionError";
  }
}

function requireNotTerminal(request: SupplierRequest, action: string): void {
  if (isTerminal(request.status)) throw new InvalidTransitionError(request.status, action);
}

export function markSent(request: SupplierRequest, sentAt: string): SupplierRequest {
  requireNotTerminal(request, "send");
  if (request.status !== "draft") throw new InvalidTransitionError(request.status, "send");
  return { ...request, status: "sent", sentAt };
}

export function markOpened(request: SupplierRequest, openedAt: string): SupplierRequest {
  // A draft was never sent, so there's no link a supplier could have followed.
  if (request.status === "draft") throw new InvalidTransitionError(request.status, "record an open for");
  const firstOpenedAt = request.openedAt ?? openedAt;
  // Once a request is fulfilled/expired/cancelled, a supplier clicking a stale link records
  // when they first opened it but never moves the status — terminal states don't move backward.
  if (isTerminal(request.status)) return { ...request, openedAt: firstOpenedAt };
  if (request.status === "sent") return { ...request, status: "opened", openedAt: firstOpenedAt };
  return { ...request, openedAt: firstOpenedAt };
}

/**
 * Records that one requested item now has an upload. Recomputes status from the item set itself
 * (fulfilmentStatus) rather than incrementing a counter, so a duplicate or out-of-order call is
 * safe to replay.
 */
export function fulfilItem(
  request: SupplierRequest,
  itemKey: string,
  fulfilledAt: string,
): SupplierRequest {
  requireNotTerminal(request, "fulfil an item for");
  const items = request.requestedItems.map((item) =>
    item.key === itemKey ? { ...item, fulfilledAt } : item,
  );
  if (!items.some((item) => item.key === itemKey)) {
    throw new Error(`Supplier request ${request.id} has no requested item "${itemKey}".`);
  }
  const derived = fulfilmentStatus(items);
  const status: SupplierRequestStatus =
    derived === "complete" ? "fulfilled" : derived === "partial" ? "partially_fulfilled" : request.status;
  return { ...request, requestedItems: items, status };
}

export function cancel(request: SupplierRequest, cancelledAt: string): SupplierRequest {
  requireNotTerminal(request, "cancel");
  return { ...request, status: "cancelled", cancelledAt };
}

/**
 * Whether a request should move to `expired` right now. Takes `asOf` explicitly (never
 * `Date.now()` internally) so the verdict is reproducible in a test and doesn't drift with
 * wall-clock time between when this is called and when its result is used — same discipline as
 * @cfm/documents' `validateIssueDate`.
 */
export function isOverdue(request: SupplierRequest, asOf: string): boolean {
  if (isTerminal(request.status)) return false;
  return asOf > request.dueAt;
}

export function expireIfDue(request: SupplierRequest, asOf: string): SupplierRequest {
  return isOverdue(request, asOf) ? { ...request, status: "expired" } : request;
}
