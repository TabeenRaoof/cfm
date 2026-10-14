# Personal data breach procedure

**Draft, 8 October 2026 (D-059). Internal runbook for the operator. For legal review.**

The DPA (§10) promises customers' owners notice **within 48 hours** of becoming aware of a breach
affecting customer personal data. This is what happens in those 48 hours. A breach is any
security incident that leads to personal data being destroyed, lost, altered, disclosed or
accessed without authority — including by mistake (a wrong export, a misdirected email).

## 1. First hour — contain

Write down the time you became aware. The clocks below start then.

| If… | Do |
|---|---|
| A server secret may be exposed | Rotate it: Supabase secret key (dashboard → API keys, then `npx wrangler secret put SUPABASE_SECRET_KEY`), Anthropic key (`npx wrangler secret put ANTHROPIC_API_KEY`), Supabase database password |
| Documents may be exposed or tampered with | Set `UPLOADS_ENABLED = "false"` in `apps/web/wrangler.toml` and deploy |
| An account is compromised | Supabase dashboard → Authentication → Users → sign the user out / delete sessions |
| The app itself is the problem | `npx wrangler rollback` (in `apps/web`) to the last good version, or remove the route in the Cloudflare dashboard |
| A provider reports a breach | Read their notice; work out which of our data it touches |

Do not delete evidence: keep logs, the change history, and the provider's notice.

## 2. By hour 24 — assess

Answer in the breach log (§5): what data, whose (which organisations, roughly how many
people), how it happened, whether it is contained, and the likely consequences for the people.
The change history (`public.audit_log`) shows who changed what; Cloudflare and Supabase logs
show access.

## 3. By hour 48 — tell customers (we are their processor)

Email every owner of each affected organisation (`legal/deletion-procedure.md` A.2's query lists
each organisation's members and roles): what happened, what data, likely consequences, what we have done, what they may need to do,
and that we will update them. It is **their** decision whether to notify their supervisory
authority (72 hours from their awareness) and the people affected. Help them with it (DPA §9).

Not knowing everything yet is not a reason to wait: send what is known, then update.

## 4. Where we are the controller — accounts, invitations, waitlist, outreach

If the breach touches data we control (records C1–C5 in `records-of-processing.md`):

- **Supervisory authority within 72 hours** of awareness, unless the breach is unlikely to
  result in a risk to people's rights. *Which authority — the ICO, an EU authority, or both —
  depends on lawyer question 1 (representatives). Settle it before uploads are switched on.*
- **The people affected, without undue delay**, if the risk to them is high.

## 5. Always — the breach log

Record every breach, including ones nobody is notified about (Art. 33(5)): date found, what
happened, data and people affected, consequences, actions, who was told and when, and why not
if not. Keep the log privately, **not in this repository**.

## 6. Afterwards

Fix the cause, add a test that would have caught it where one can, and record the change in
`project-setup/decisions.md`.
