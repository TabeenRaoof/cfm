/**
 * The Pages Functions environment shape (`05-interim-waitlist-plan.md` §3.1). `DB` is the D1
 * binding created with `--jurisdiction=eu` — set up per `apps/scanner/README.md` — and
 * `UNSUB_SECRET` is a Pages secret (`wrangler pages secret put UNSUB_SECRET`), never a plaintext
 * environment variable, since it lets anyone who has it forge an unsubscribe link for any
 * address on the list.
 */
export interface Env {
  readonly DB: D1Database;
  readonly UNSUB_SECRET: string;
  /** Defaults to "v1" in code if unset — see subscribe.ts. Bump it if the consent wording changes. */
  readonly CONSENT_TEXT_VERSION?: string;
}
