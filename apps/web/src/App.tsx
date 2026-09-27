import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Dpa } from "./legal/Dpa.tsx";
import { PrivacyPolicy } from "./legal/PrivacyPolicy.tsx";
import { supabase } from "./lib/supabase.ts";
import { SignIn } from "./SignIn.tsx";
import { Workspace } from "./Workspace.tsx";

/**
 * The legal pages are public and need neither sign-in nor Supabase, so they are chosen before
 * either. The Worker's SPA fallback serves index.html at /privacy and /dpa (wrangler.toml).
 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/privacy") return <PrivacyPolicy />;
  if (path === "/dpa") return <Dpa />;
  return <SignedIn />;
}

function SignedIn() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <main className="page narrow">
        <h1>Not configured</h1>
        <p>
          This build has no Supabase settings, so nobody can sign in. Set
          <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> — see
          <code> apps/web/.env.example</code>.
        </p>
      </main>
    );
  }
  if (loading) return <main className="page narrow"><p>Loading…</p></main>;
  if (!session) return <SignIn client={supabase} />;
  return <Workspace client={supabase} session={session} />;
}
