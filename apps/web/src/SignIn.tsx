import type { SupabaseClient } from "@supabase/supabase-js";
import { useState, type FormEvent } from "react";

/** Email magic-link sign-in (Supabase Auth). No passwords stored anywhere by us. */
export function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    const { error: failure } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (failure) {
      setError(failure.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <main className="page narrow">
      <h1>Sign in</h1>
      {state === "sent" ? (
        <p className="notice">
          Check <strong>{email.trim()}</strong> for a sign-in link. It works once and expires after a
          short while.
        </p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Work email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      )}
    </main>
  );
}
