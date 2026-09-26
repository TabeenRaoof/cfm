import type { AddSubscriberResult, RemoveSubscriberResult, ScanCount, WaitlistStore } from "./store.ts";
import type { ValidSubscription } from "./validate.ts";

/** The `WaitlistStore` used by every test in this repo, and a reference for the D1 adapter's behaviour. */
export class MemoryStore implements WaitlistStore {
  private readonly subscribers = new Map<string, ValidSubscription>();
  private readonly scans = new Map<string, number>(); // key: `${iso}|${day}`

  async addSubscriber(subscription: ValidSubscription): Promise<AddSubscriberResult> {
    if (this.subscribers.has(subscription.email)) return "already_subscribed";
    this.subscribers.set(subscription.email, subscription);
    return "added";
  }

  async removeByEmail(email: string): Promise<RemoveSubscriberResult> {
    return this.subscribers.delete(email) ? "removed" : "not_found";
  }

  async listSubscribers(): Promise<readonly ValidSubscription[]> {
    return [...this.subscribers.values()];
  }

  async countSubscribers(): Promise<number> {
    return this.subscribers.size;
  }

  async incrementScan(iso: string, day: string): Promise<void> {
    const key = `${iso}|${day}`;
    this.scans.set(key, (this.scans.get(key) ?? 0) + 1);
  }

  async scanCounts(): Promise<readonly ScanCount[]> {
    return [...this.scans.entries()].map(([key, n]) => {
      const [iso, day] = key.split("|") as [string, string];
      return { iso, day, n };
    });
  }
}
