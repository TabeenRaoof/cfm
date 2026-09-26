/**
 * `npm run waitlist:count` — `05-interim-waitlist-plan.md` §7. Prints the two Gate 2 numbers
 * (D-025's revision of `01-` §10: 100 scans or 60 waitlist signups by 20 December 2026):
 * waitlist signups, and completed scans (D-047). Market slice loads are printed separately and
 * labelled as such — they show which markets people check, not how many scans ran.
 */

import { runD1 } from "./wrangler-d1.ts";

const signups = runD1<{ n: number }>("SELECT COUNT(*) AS n FROM subscriber")[0]?.n ?? 0;
console.log(`Waitlist signups: ${signups}`);

const runs = runD1<{ week: string; n: number }>(
  `SELECT strftime('%Y-W%W', day) AS week, SUM(n) AS n FROM scan_runs GROUP BY week ORDER BY week`,
);
const totalScans = runs.reduce((sum, row) => sum + row.n, 0);
console.log(`Completed scans: ${totalScans}`);
for (const row of runs) console.log(`  ${row.week}: ${row.n}`);

const loads = runD1<{ iso: string; n: number }>(
  `SELECT iso, SUM(n) AS n FROM scan_counts GROUP BY iso ORDER BY n DESC`,
);
console.log(`\nMarkets checked (slice loads — not a scan count; one scan can load several):`);
if (loads.length === 0) console.log("  (none yet)");
for (const row of loads) console.log(`  ${row.iso}: ${row.n}`);
