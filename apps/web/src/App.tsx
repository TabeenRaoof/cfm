import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.ts";
import { SignIn } from "./SignIn.tsx";
import { Workspace } from "./Workspace.tsx";

export function App() {
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
