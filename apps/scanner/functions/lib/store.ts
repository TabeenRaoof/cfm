/**
 * The D1 adapter for `@cfm/waitlist`'s `WaitlistStore` (`05-interim-waitlist-plan.md` §3.3-3.4).
 * This is the only place in the deployment that knows D1 exists — every route handler depends on
 * the interface, not on this class, so a later move to Supabase or a bulk MailerLite import is a
 * new adapter here, not a rewrite of subscribe.ts / unsubscribe.ts / [iso].ts.
 *
 * Lives under `functions/` rather than in `@cfm/waitlist` because `D1Database` is a Workers
 * runtime type this package doesn't otherwise depend on — the same reasoning that keeps
 * `@cfm/catalog`'s Node entry point separate from its pure one, pointed at a different runtime.
 */

import type { AddSubscriberResult, RemoveSubscriberResult, ScanCount, ValidSubscription, WaitlistStore } from "@cfm/waitlist";

interface SubscriberRow {
  readonly email: string;
  readonly sku_count: string | null;
  readonly consented_at: string;
  readonly consent_text_version: string;
}

export class D1Store implements WaitlistStore {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async addSubscriber(subscription: ValidSubscription): Promise<AddSubscriberResult> {
    const result = await this.db
      .prepare(
        `INSERT INTO subscriber (email, sku_count, consented_at, consent_text_version)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (email) DO NOTHING`,
      )
      .bind(subscription.email, subscription.skuCount, subscription.consentedAt, subscription.consentTextVersion)
      .run();
    // meta.changes is 0 when the ON CONFLICT DO NOTHING branch fired — i.e. already subscribed.
    return result.meta.changes > 0 ? "added" : "already_subscribed";
  }

  async removeByEmail(email: string): Promise<RemoveSubscriberResult> {
    const result = await this.db.prepare(`DELETE FROM subscriber WHERE email = ?`).bind(email).run();
    return result.meta.changes > 0 ? "removed" : "not_found";
  }

  async listSubscribers(): Promise<readonly ValidSubscription[]> {
    const { results } = await this.db
      .prepare(`SELECT email, sku_count, consented_at, consent_text_version FROM subscriber ORDER BY consented_at`)
      .all<SubscriberRow>();
    return results.map((row) => ({
      email: row.email,
      skuCount: row.sku_count,
      consentedAt: row.consented_at,
      consentTextVersion: row.consent_text_version,
      source: "waitlist" as const,
    }));
  }

  async countSubscribers(): Promise<number> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS n FROM subscriber`).first<{ n: number }>();
    return row?.n ?? 0;
  }

  async incrementScan(iso: string, day: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO scan_counts (iso, day, n) VALUES (?, ?, 1)
         ON CONFLICT (iso, day) DO UPDATE SET n = n + 1`,
      )
      .bind(iso, day)
      .run();
  }

  async scanCounts(): Promise<readonly ScanCount[]> {
    const { results } = await this.db.prepare(`SELECT iso, day, n FROM scan_counts ORDER BY day, iso`).all<ScanCount>();
    return results;
  }
}
