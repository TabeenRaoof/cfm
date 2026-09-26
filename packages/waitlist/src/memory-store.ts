import type {
  AddSubscriberResult,
  MarketLoadCount,
  RemoveSubscriberResult,
  ScanRunCount,
  WaitlistStore,
} from "./store.ts";
import type { ValidSubscription } from "./validate.ts";

/** The `WaitlistStore` used by every test in this repo, and a reference for the D1 adapter's behaviour. */
export class MemoryStore implements WaitlistStore {
  private readonly subscribers = new Map<string, ValidSubscription>();
  private readonly loads = new Map<string, number>(); // key: `${iso}|${day}`
  private readonly runs = new Map<string, number>(); // key: day

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

  async incrementMarketLoad(iso: string, day: string): Promise<void> {
    const key = `${iso}|${day}`;
    this.loads.set(key, (this.loads.get(key) ?? 0) + 1);
  }

  async marketLoads(): Promise<readonly MarketLoadCount[]> {
    return [...this.loads.entries()].map(([key, n]) => {
      const [iso, day] = key.split("|") as [string, string];
      return { iso, day, n };
    });
  }

  async incrementScanRun(day: string): Promise<void> {
    this.runs.set(day, (this.runs.get(day) ?? 0) + 1);
  }

  async scanRuns(): Promise<readonly ScanRunCount[]> {
    return [...this.runs.entries()].map(([day, n]) => ({ day, n }));
  }
}
