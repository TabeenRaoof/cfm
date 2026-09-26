import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ESTABLISHMENT_COUNTRIES } from "./countries.ts";
import type { MyOrganisation } from "./lib/types.ts";
import { Products } from "./Products.tsx";

function selectedFromHash(): string | null {
  const match = /org=([0-9a-f-]{36})/.exec(window.location.hash);
  return match?.[1] ?? null;
}

export function Workspace({ client, session }: { client: SupabaseClient; session: Session }) {
  const [orgs, setOrgs] = useState<readonly MyOrganisation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(selectedFromHash);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Row-level security already limits this to the user's own memberships; the filter keeps
    // the query honest about what it means rather than relying on that.
    const { data, error: failure } = await client
      .from("membership")
      .select("role, organisation:organisation_id (id, name, establishment_country)")
      .eq("user_id", session.user.id)
      .order("created_at");
    if (failure) {
      setError(failure.message);
      return;
    }
    setOrgs((data ?? []) as unknown as MyOrganisation[]);
  }, [client, session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onHash = () => setSelected(selectedFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const current = orgs?.find((o) => o.organisation.id === selected) ?? null;

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Compliance file manager</strong>
        <span className="spacer" />
        <span className="muted">{session.user.email}</span>
        <button className="link" onClick={() => void client.auth.signOut()}>Sign out</button>
      </header>

      <main className="page">
        {error && <p className="error" role="alert">{error}</p>}
        {orgs === null && !error && <p>Loading…</p>}

        {orgs !== null && !current && (
          <>
            <h1>Your organisations</h1>
            {orgs.length === 0 ? (
              <p className="muted">You're not in any organisation yet. Create one to start.</p>
            ) : (
              <ul className="list">
                {orgs.map(({ organisation, role }) => (
                  <li key={organisation.id}>
                    <a href={`#org=${organisation.id}`}>{organisation.name}</a>
                    <span className="muted"> · {role}</span>
                  </li>
                ))}
              </ul>
            )}
            <CreateOrganisation client={client} onCreated={(id) => {
              void load();
              window.location.hash = `org=${id}`;
            }} />
          </>
        )}

        {current && (
          <>
            <p><a href="#">← All organisations</a></p>
            <h1>{current.organisation.name}</h1>
            <p className="muted">
              Established in: {current.organisation.establishment_country ?? "not stated"} · Your role: {current.role}
            </p>
            <Products client={client} organisationId={current.organisation.id} role={current.role} />
          </>
        )}
      </main>
    </div>
  );
}

function CreateOrganisation({ client, onCreated }: { client: SupabaseClient; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: failure } = await client.rpc("create_organisation", {
      p_name: name.trim(),
      p_establishment_country: country || null,
    });
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setName("");
    setCountry("");
    onCreated(data as string);
  }

  return (
    <section className="card">
      <h2>Create an organisation</h2>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Business name</span>
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Where the business is established</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Not stated yet</option>
            {ESTABLISHMENT_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>{c.name}</option>
            ))}
          </select>
          <small className="muted">
            This decides which EU obligations treat you as "non-EU". Leaving it unstated means we
            show those requirements as undetermined, never as not applying.
          </small>
        </label>
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create organisation"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
