/**
 * The processors that touch customer data, shared by the privacy policy and the DPA so the two
 * cannot disagree. Every claim here was checked against the vendor's own documentation on
 * 27 September 2026 (D-053); re-check before changing LAST_UPDATED.
 */

import type { AuthEmailSender } from "./senders.ts";

export interface Subprocessor {
  readonly name: string;
  readonly purpose: string;
  readonly location: string;
  readonly safeguard: string;
}

const SUPABASE: Subprocessor = {
  name: "Supabase, Inc.",
  purpose:
    "Database and sign-in: account email addresses, organisations, products, product facts, " +
    "document records and extracted fields, and the change history.",
  location: "European Union — Frankfurt, Germany.",
  safeguard: "Supabase's data processing agreement, including the EU standard contractual clauses.",
};

const CLOUDFLARE: Subprocessor = {
  name: "Cloudflare, Inc.",
  purpose:
    "Hosting the application, storing uploaded document files, and the processing queue that " +
    "reads them.",
  location:
    "Uploaded files are stored in Cloudflare's EU jurisdiction. Requests and processing run on " +
    "Cloudflare's global network, usually in the data centre nearest the person using the service.",
  safeguard:
    "Cloudflare's data processing addendum, including the EU standard contractual clauses and the " +
    "UK addendum.",
};

const ANTHROPIC: Subprocessor = {
  name: "Anthropic, PBC",
  purpose:
    "Reading an uploaded document to find the fields our own rules could not (for example an " +
    "expiry date on a scanned certificate). Only the document's text, or the file itself when it " +
    "has no text layer, is sent — with no account or organisation details.",
  location:
    "United States (data at rest). Anthropic offers no EU processing option. Inputs and outputs are " +
    "deleted within 30 days, or kept up to 2 years if flagged for a usage-policy violation, and are " +
    "not used to train models.",
  safeguard: "Anthropic's data processing addendum, including the EU standard contractual clauses and the UK addendum.",
};

const SIGN_IN_EMAIL: Record<AuthEmailSender, string> = {
  supabase: "Sign-in links are sent by Supabase's own email service (Supabase, Inc., above).",
};

export function subprocessors(): readonly Subprocessor[] {
  return [SUPABASE, CLOUDFLARE, ANTHROPIC];
}

export function signInEmailStatement(sender: AuthEmailSender | null): string {
  return sender ? SIGN_IN_EMAIL[sender] : "No sign-in email sender is configured for this build.";
}
