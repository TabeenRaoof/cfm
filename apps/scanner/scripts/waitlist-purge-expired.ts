/**
 * `npm run waitlist:purge-expired` — the mechanism behind the privacy notice's retention line
 * ("no longer than two years from the day you signed up"). A promise in a privacy notice with no
 * process behind it is a false statement waiting to become true by accident (D-027, D-047).
 *
 * Run it at least monthly — the natural moment is just before sending each digest, so no one past
 * their retention date is ever emailed. Dry run by default; `--confirm` deletes.
 */

import { runD1 } from "./wrangler-d1.ts";

const cutoff = new Date();
cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
const cutoffIso = cutoff.toISOString();

const expired = runD1<{ n: number }>(
  `SELECT COUNT(*) AS n FROM subscriber WHERE consented_at < '${cutoffIso}'`,
)[0]?.n ?? 0;

if (expired === 0) {
  console.log(`No subscriber signed up before ${cutoffIso.slice(0, 10)}. Nothing to purge.`);
  process.exit(0);
}

if (!process.argv.includes("--confirm")) {
  console.log(`${expired} subscriber(s) signed up before ${cutoffIso.slice(0, 10)} and are past retention.`);
  console.log("Dry run — nothing deleted. Re-run with --confirm to delete them.");
  process.exit(0);
}

runD1(`DELETE FROM subscriber WHERE consented_at < '${cutoffIso}'`);
console.log(`Deleted ${expired} subscriber(s) past the two-year retention limit.`);
