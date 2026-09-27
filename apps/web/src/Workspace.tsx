import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ESTABLISHMENT_COUNTRIES } from "./countries.ts";
import { ORGANISATION_COLUMNS, type MyOrganisation } from "./lib/types.ts";
import { Documents } from "./Documents.tsx";
import { Members } from "./Members.tsx";
import { OrganisationDetails } from "./OrganisationDetails.tsx";
import { Products } from "./Products.tsx";
import { Readiness } from "./Readiness.tsx";

const TABS = [
  ["readiness", "Readiness"],
  ["products", "Products"],
  ["documents", "Documents"],
  ["details", "Organisation details"],
  ["members", "Members"],
] as const;
type Tab = (typeof TABS)[number][0];

function fromHash(): { org: string | null; tab: Tab } {
  const org = /org=([0-9a-f-]{36})/.exec(window.location.hash)?.[1] ?? null;
  const tab = /tab=([a-z]+)/.exec(window.location.hash)?.[1] as Tab | undefined;
  return { org, tab: TABS.some(([t]) => t === tab) ? (tab as Tab) : "readiness" };
}

export function Workspace({ client, session }: { client: SupabaseClient; session: Session }) {
  const [orgs, setOrgs] = useState<readonly MyOrganisation[] | null>(null);
  const [route, setRoute] = useState(fromHash);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Row-level security already limits this to the user's own memberships; the filter keeps
    // the query honest about what it means rather than relying on that.
    const { data, error: failure } = await client
      .from("membership")
      .select(`role, organisation:organisation_id (${ORGANISATION_COLUMNS})`)
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
    const onHash = () => setRoute(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const current = orgs?.find((o) => o.organisation.id === route.org) ?? null;

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
            <PendingInvitations client={client} onAccepted={(id) => {
              void load();
              window.location.hash = `org=${id}`;
            }} />
            <h1>Your organisations</h1>
            {orgs.length === 0 ? (
              <p className="muted">You're not in any organisation yet. Create one, or ask to be invited.</p>
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
            <nav className="tabs" aria-label="Organisation">
              {TABS.map(([tab, label]) => (
                <a key={tab} href={`#org=${current.organisation.id}&tab=${tab}`} aria-current={route.tab === tab ? "page" : undefined}>
                  {label}
                </a>
              ))}
            </nav>
            {route.tab === "readiness" && (
              <Readiness client={client} organisation={current.organisation} role={current.role} onChanged={() => void load()} />
            )}
            {route.tab === "products" && (
              <Products client={client} organisationId={current.organisation.id} role={current.role} />
            )}
            {route.tab === "documents" && (
              <Documents client={client} organisation={current.organisation} role={current.role} onChanged={() => void load()} />
            )}
            {route.tab === "details" && (
              <OrganisationDetails client={client} organisation={current.organisation} role={current.role} onSaved={() => void load()} />
            )}
            {route.tab === "members" && (
              <Members client={client} organisationId={current.organisation.id} role={current.role} selfId={session.user.id} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

interface Invitation {
  readonly id: string;
  readonly organisation_name: string;
  readonly role: string;
  readonly expires_at: string;
}

function PendingInvitations({ client, onAccepted }: { client: SupabaseClient; onAccepted: (orgId: string) => void }) {
  const [invitations, setInvitations] = useState<readonly Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc("my_invitations");
    if (failure) setError(failure.message);
    else setInvitations((data ?? []) as Invitation[]);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, accept: boolean) {
    setError(null);
    const { data, error: failure } = accept
      ? await client.rpc("accept_invitation", { p_invitation_id: id })
      : await client.rpc("decline_invitation", { p_invitation_id: id });
    if (failure) {
      setError(failure.message);
      return;
    }
    await load();
    if (accept) onAccepted(data as string);
  }

  if (invitations.length === 0 && !error) return null;
  return (
    <section className="card notice-card">
      <h2>You've been invited</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="list">
        {invitations.map((inv) => (
          <li key={inv.id}>
            <strong>{inv.organisation_name}</strong> as {inv.role}
            <span className="muted"> · expires {new Date(inv.expires_at).toLocaleDateString()}</span>{" "}
            <button onClick={() => void respond(inv.id, true)}>Accept</button>{" "}
            <button className="link" onClick={() => void respond(inv.id, false)}>Decline</button>
          </li>
        ))}
      </ul>
    </section>
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
