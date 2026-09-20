/**
 * Reminder scheduling for an open supplier request (`02-` §10.1 week 7: "reminders (Inngest
 * cron)"). This module decides *whether* a reminder is due; it deliberately knows nothing about
 * sending email or about Inngest — a cron job calls `dueReminder` on each open request and acts
 * on the answer. That keeps the policy testable with fixed dates instead of real timers.
 */

import { isTerminal, type SupplierRequest } from "./request.ts";

/**
 * Days before `dueAt` that a reminder fires, most-distant first. A request due in 10 days gets
 * one reminder at day 7-before and one at day 3-before; a request due tomorrow gets none of
 * these (there's no week-out warning to give) but still gets the final one.
 */
export const REMINDER_OFFSETS_DAYS: readonly number[] = [7, 3, 1];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / MS_PER_DAY;
}

/**
 * The next reminder that is due, or null if none is. `asOf` is required explicitly rather than
 * read from the clock inside — see request.ts `isOverdue` for the same rule and why.
 *
 * A reminder is due once its offset's trigger date has passed, so long as fewer reminders have
 * been sent than have come due — this makes a missed cron run (the job didn't run for two days)
 * catch up by sending the most-overdue one next, rather than silently skipping it.
 */
export function dueReminder(request: SupplierRequest, asOf: string): number | null {
  if (isTerminal(request.status) || request.status === "draft") return null;

  const daysUntilDue = daysBetween(asOf, request.dueAt);
  // Once the deadline has passed, a reminder about it is not useful — what happens next is
  // expiry (request.ts `expireIfDue`), not another nudge about a date already gone. Without
  // this, every offset in the schedule satisfies `daysUntilDue <= offset` for a negative
  // daysUntilDue, so an un-expired overdue request would keep working through its remaining
  // reminders one cron run at a time regardless of how long ago the deadline passed.
  if (daysUntilDue < 0) return null;
  const dueOffsetIndexes = REMINDER_OFFSETS_DAYS
    .map((offset, index) => ({ offset, index }))
    .filter(({ offset }) => daysUntilDue <= offset)
    .map(({ index }) => index);

  const nextIndex = request.remindersSent.length;
  if (nextIndex >= REMINDER_OFFSETS_DAYS.length) return null; // schedule exhausted
  return dueOffsetIndexes.includes(nextIndex) ? nextIndex : null;
}

export function recordReminderSent(request: SupplierRequest, sentAt: string): SupplierRequest {
  return { ...request, remindersSent: [...request.remindersSent, sentAt] };
}
