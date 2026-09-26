/**
 * The storage seam (`05-interim-waitlist-plan.md` §3.4) — same reasoning as `@cfm/ai`'s
 * `Provider`: the validation and request-handling logic in this package and in
 * `apps/scanner/functions` depends only on this interface, never on D1 or any other backend
 * directly, so a later move to Supabase or a straight MailerLite import is a new adapter, not a
 * rewrite. `MemoryStore` below is the adapter used by every test; `apps/scanner/functions`
 * carries the D1 adapter, which needs the Workers runtime to run and so cannot live in this
 * package (same rule that splits `@cfm/catalog`'s Node entry from its pure one, just pointed at
 * a runtime this package doesn't take a dependency on rather than at `node:`).
 */

import type { ValidSubscription } from "./validate.ts";

export type AddSubscriberResult = "added" | "already_subscribed";
export type RemoveSubscriberResult = "removed" | "not_found";

/** How often a market's catalog slice was loaded — which markets people check, not how many scans. */
export interface MarketLoadCount {
  readonly iso: string;
  readonly day: string; // YYYY-MM-DD, UTC
  readonly n: number;
}

/** Completed scans per day — the Gate 2 number (decisions.md D-047). */
export interface ScanRunCount {
  readonly day: string; // YYYY-MM-DD, UTC
  readonly n: number;
}

export interface WaitlistStore {
  /** Idempotent: a repeat signup from an already-subscribed address changes nothing. */
  addSubscriber(subscription: ValidSubscription): Promise<AddSubscriberResult>;
  removeByEmail(email: string): Promise<RemoveSubscriberResult>;
  listSubscribers(): Promise<readonly ValidSubscription[]>;
  countSubscribers(): Promise<number>;
  /**
   * Not a scan count: one scan can load several markets, and the scanner caches slices for the
   * page's lifetime, so a re-scan loads none. Use `incrementScanRun` for scans.
   */
  incrementMarketLoad(iso: string, day: string): Promise<void>;
  marketLoads(): Promise<readonly MarketLoadCount[]>;
  incrementScanRun(day: string): Promise<void>;
  scanRuns(): Promise<readonly ScanRunCount[]>;
}
