/**
 * GET /catalog/:file — the scanner's usage counters (`05-interim-waitlist-plan.md` §3.1, D-043
 * decision 4, D-047). Both serve the exact same static file unchanged via `context.next()`; the
 * Function only adds one to a counter first.
 *
 * - `/catalog/index.json` is fetched once per completed scan (`src/main.ts` `countScan`), with
 *   caching off → one scan run. This is the Gate 2 number.
 * - `/catalog/<ISO>.json` is a market slice load → which markets people check. It is not a scan
 *   count: one scan can load several markets, and the page caches slices, so a re-scan loads none.
 *
 * Nothing about the visitor or their file is stored — only the UTC day and, for slice loads, the
 * market code. Anything else under `/catalog/` falls straight through uncounted.
 *
 * Cloudflare Pages Functions capture the whole path segment, extension included, so a request to
 * `/catalog/DE.json` gives `context.params.iso === "DE.json"` here.
 */

import type { Env } from "../lib/env.ts";
import { D1Store } from "../lib/store.ts";

const MARKET_FILE = /^([A-Z]{2})\.json$/;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = context.params.iso;
  const segment = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const day = new Date().toISOString().slice(0, 10); // UTC

  try {
    const store = new D1Store(context.env.DB);
    if (segment === "index.json") {
      await store.incrementScanRun(day);
    } else {
      const match = MARKET_FILE.exec(segment);
      if (match) await store.incrementMarketLoad(match[1] as string, day);
    }
  } catch (error) {
    // Counting is not why the visitor is here — a store failure must never turn into a failure to
    // serve the file their scan depends on.
    console.error(`usage count failed for ${segment}/${day}:`, error);
  }

  return context.next();
};
