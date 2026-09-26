/**
 * `npm run waitlist:count` — `05-interim-waitlist-plan.md` §7. Prints the two Gate 2 numbers
 * (`01-` §10): total waitlist signups, and scans per market by week.
 */

import { runD1 } from "./wrangler-d1.ts";

const totalRow = runD1<{ n: number }>("SELECT COUNT(*) AS n FROM subscriber");
console.log(`Waitlist signups: ${totalRow[0]?.n ?? 0}`);

const scanRows = runD1<{ iso: string; week: string; n: number }>(
  `SELECT iso, strftime('%Y-W%W', day) AS week, SUM(n) AS n
   FROM scan_counts GROUP BY iso, week ORDER BY week, iso`,
);
console.log(`\nScans by market and week:`);
if (scanRows.length === 0) {
  console.log("  (none yet)");
} else {
  for (const row of scanRows) console.log(`  ${row.week}  ${row.iso}: ${row.n}`);
}

const totalScans = scanRows.reduce((sum, row) => sum + row.n, 0);
console.log(`\nTotal scans: ${totalScans}`);
