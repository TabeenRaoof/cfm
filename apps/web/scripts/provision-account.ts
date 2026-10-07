/**
 * Creates a design partner's first account (D-057, D-058). Self-signup is off, so someone the
 * operator has approved can't sign in until their account exists. Everyone after the first is
 * added by the partner from the Members tab, which provisions accounts the same way.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… \
 *     npm run -w @cfm/web provision-account -- partner@example.com
 *
 * The account is created confirmed and without a password: GoTrue won't send a sign-in link to
 * an unconfirmed account while signup is off, and with no password the only way in is a link
 * sent to that inbox. Nothing is emailed by this script — tell the partner to sign in.
 */

import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npm run -w @cfm/web provision-account -- partner@example.com");
  process.exit(1);
}
if (!url || !secret) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (Supabase dashboard → Project Settings → API keys).");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });

if (error) {
  if (error.code !== "email_exists" && !/already been registered/i.test(error.message)) {
    console.error(`Couldn't create the account: ${error.message}`);
    process.exit(1);
  }
  // An account that exists but was never confirmed (someone who started signing up before
  // D-057 closed it) would still be refused a sign-in link, so confirm it.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing && !existing.email_confirmed_at) {
    const confirmed = await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    if (confirmed.error) {
      console.error(`${email} exists but couldn't be confirmed: ${confirmed.error.message}`);
      process.exit(1);
    }
    console.log(`${email} had an unconfirmed account — confirmed it. They can sign in now.`);
    process.exit(0);
  }
  console.log(`${email} already has an account — nothing to do. They can sign in now.`);
  process.exit(0);
}

console.log(`Created a confirmed account for ${email} (${data.user.id}) on ${new URL(url).host}.`);
console.log("Next: tell them to sign in at the app with exactly this address, then create their organisation.");
