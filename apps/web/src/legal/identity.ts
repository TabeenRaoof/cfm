/**
 * Who stands behind the service, for the privacy policy and the DPA (D-053). Build-time values:
 * a production build refuses without the name, the contact email and a known sign-in email sender
 * (vite.config.ts), so a legal page can't ship with a blank where the controller belongs.
 * The postal address is optional (D-043 §5 decision 2) — unset, the pages offer it on request.
 */

import { AUTH_EMAIL_SENDERS, type AuthEmailSender } from "./senders.ts";

const env = import.meta.env;

export const CONTROLLER_NAME = (env.VITE_CONTROLLER_NAME as string | undefined) || "[controller name not set]";
export const CONTACT_EMAIL = (env.VITE_CONTACT_EMAIL as string | undefined) || "[contact email not set]";
export const CONTROLLER_ADDRESS = (env.VITE_CONTROLLER_ADDRESS as string | undefined) || null;

/** `null` only in a preview build; the pages then say no sender is configured. */
export const AUTH_EMAIL_SENDER: AuthEmailSender | null =
  AUTH_EMAIL_SENDERS.find((sender) => sender === env.VITE_AUTH_EMAIL_SENDER) ?? null;

/**
 * False until the texts have been reviewed by a lawyer and the erasure path they describe exists
 * (legal/README.md). While false, both pages carry a "draft, not yet in force" banner.
 */
export const IN_FORCE = false;

/** Shown at the top of both pages. Change it whenever the text changes materially. */
export const LAST_UPDATED = "27 September 2026";
