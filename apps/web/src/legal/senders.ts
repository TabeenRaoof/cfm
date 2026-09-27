/**
 * Who may deliver sign-in emails. Each value needs its own processor text in the privacy policy
 * and a row in the DPA's sub-processor list. vite.config.ts refuses a production build with any
 * other value, so changing sender (Supabase's built-in email only reaches the project's own team)
 * forces those texts to be written first. Kept free of import.meta so vite.config.ts can import it.
 */
export const AUTH_EMAIL_SENDERS = ["supabase"] as const;
export type AuthEmailSender = (typeof AUTH_EMAIL_SENDERS)[number];
