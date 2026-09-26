/**
 * Shared helper for the operator scripts (`05-interim-waitlist-plan.md` §7): runs one SQL
 * statement against the real D1 database via `wrangler d1 execute --remote --json` and returns
 * its parsed result rows. All three `waitlist:*` scripts go through this rather than talking to
 * D1 directly, so there is exactly one place that knows how to invoke wrangler and parse its
 * output.
 *
 * Needs Cloudflare credentials wrangler already knows about (an interactive `wrangler login`, or
 * `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` in `.env.local`) — never printed here or
 * anywhere else.
 */

import { execFileSync } from "node:child_process";

const DATABASE_NAME = "cfm-waitlist"; // must match wrangler.toml's database_name

interface WranglerD1ExecuteResult<Row> {
  readonly results: readonly Row[];
  readonly success: boolean;
  readonly meta: { readonly changes?: number; readonly [key: string]: unknown };
}

/** Runs one statement remotely and returns its result rows, typed by the caller. */
export function runD1<Row = Record<string, unknown>>(sql: string): readonly Row[] {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE_NAME, "--remote", "--json", "--command", sql],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(output) as readonly WranglerD1ExecuteResult<Row>[];
  const [first] = parsed;
  if (!first?.success) {
    throw new Error(`wrangler d1 execute did not report success. Raw output:\n${output}`);
  }
  return first.results;
}

/** Very small defence-in-depth: the same syntax `@cfm/waitlist`'s validator already requires. */
export function assertLooksLikeEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`"${email}" does not look like an email address — refusing to build a query with it.`);
  }
}

/** Escapes a value for interpolation into a `--command` string — wrangler's CLI takes raw SQL, not bound params. */
export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
