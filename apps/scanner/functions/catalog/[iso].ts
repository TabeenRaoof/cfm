/**
 * GET /catalog/:iso.json — `05-interim-waitlist-plan.md` §3.1 and §5 decision 4, amending D-021.
 *
 * D-021 counted scans from the static host's own request logs. Free-tier static hosts generally
 * keep few or no request logs, so that number likely can't be produced in practice; this counts
 * the same event (a market's catalog slice being fetched) explicitly instead. Nothing about the
 * visitor's file is involved — this fires before the browser has even read anything, and it
 * changes nothing else about how the scanner works: the response served is the exact same static
 * JSON file, and a request for anything that isn't a two-letter market code falls straight
 * through to the asset server uncounted.
 *
 * Cloudflare Pages Functions capture the whole path segment, extension included, so a request to
 * `/catalog/DE.json` gives `context.params.iso === "DE.json"` here — there is no separate
 * dynamic-plus-suffix routing form for this.
 */

import type { Env } from "../lib/env.ts";
import { D1Store } from "../lib/store.ts";

const MARKET_FILE = /^([A-Z]{2})\.json$/;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = context.params.iso;
  const segment = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const match = MARKET_FILE.exec(segment);

  if (match) {
    const iso = match[1] as string;
    const day = new Date().toISOString().slice(0, 10); // UTC, matches @cfm/waitlist's scan_counts.day
    try {
      await new D1Store(context.env.DB).incrementScan(iso, day);
    } catch (error) {
      // Counting is not why the visitor is here — a store failure must never turn into a
      // failure to serve the catalog slice their scan actually depends on.
      console.error(`scan count failed for ${iso}/${day}:`, error);
    }
  }

  return context.next();
};
