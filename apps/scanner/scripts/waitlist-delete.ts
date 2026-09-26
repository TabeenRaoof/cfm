/**
 * `npm run waitlist:delete -- <email>` — `05-interim-waitlist-plan.md` §7. Handles an erasure
 * request by hand, for whoever's turn it is to answer one before there's a self-serve
 * unsubscribe-triggered deletion path other than the link itself (`functions/api/unsubscribe.ts`
 * already handles the normal case — this is for a request made by email or letter instead).
 */

import { assertLooksLikeEmail, runD1, sqlString } from "./wrangler-d1.ts";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run waitlist:delete -- <email>");
  process.exit(1);
}
assertLooksLikeEmail(email);

const normalised = email.trim().toLowerCase();
const before = runD1<{ n: number }>(`SELECT COUNT(*) AS n FROM subscriber WHERE email = ${sqlString(normalised)}`);
if ((before[0]?.n ?? 0) === 0) {
  console.log(`${normalised} was not on the list. Nothing to delete.`);
  process.exit(0);
}

runD1(`DELETE FROM subscriber WHERE email = ${sqlString(normalised)}`);
console.log(`Deleted ${normalised} from the waitlist.`);
