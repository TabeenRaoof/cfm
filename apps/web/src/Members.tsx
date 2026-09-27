import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CAN_MANAGE, type Role } from "./lib/types.ts";

interface Member {
  readonly user_id: string;
  readonly email: string;
  readonly role: Role;
}

interface PendingInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly expires_at: string;
}

/**
 * Members and invitations. The database decides what's allowed (the membership guard and the
 * invitation policies, migrations 0001–0002); this screen only offers what the role can do and
 * shows the database's refusal verbatim when it says no.
 */
export function Members({ client, organisationId, role, selfId }: {
  client: SupabaseClient;
  organisationId: string;
  role: Role;
  selfId: string;
}) {
  const [members, setMembers] = useState<readonly Member[] | null>(null);
  const [invitations, setInvitations] = useState<readonly PendingInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canManage = CAN_MANAGE.includes(role);

  const load = useCallback(async () => {
    const members = await client.rpc("organisation_members", { p_organisation_id: organisationId });
    if (members.error) {
      setError(members.error.message);
      return;
    }
    setMembers((members.data ?? []) as Member[]);
    if (canManage) {
      const pending = await client
        .from("invitation")
        .select("id, email, role, expires_at")
        .eq("organisation_id", organisationId)
        .order("created_at");
      if (pending.error) setError(pending.error.message);
      else setInvitations((pending.data ?? []) as PendingInvitation[]);
    }
  }, [client, organisationId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error: failure } = await action;
    if (failure) setError(failure.message);
    await load();
  }

  const changeRole = (userId: string, next: string) =>
    run(client.from("membership").update({ role: next }).eq("organisation_id", organisationId).eq("user_id", userId));
  const remove = (userId: string) =>
    run(client.from("membership").delete().eq("organisation_id", organisationId).eq("user_id", userId));
  const revoke = (id: string) => run(client.from("invitation").delete().eq("id", id));

  return (
    <section>
      <h2>Members</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {members === null && !error && <p>Loading…</p>}
      {members && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Email</th><th>Role</th>{canManage && <th />}</tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.email}{m.user_id === selfId && <span className="muted"> (you)</span>}</td>
                  <td>
                    {canManage ? (
                      <select value={m.role} onChange={(e) => void changeRole(m.user_id, e.target.value)}>
                        {(["owner", "admin", "member", "viewer"] as const).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : m.role}
                  </td>
                  {canManage && (
                    <td><button className="link" onClick={() => void remove(m.user_id)}>Remove</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!canManage && (
        <p><button className="link" onClick={() => void remove(selfId)}>Leave this organisation</button></p>
      )}

      {canManage && (
        <>
          <h3>Pending invitations</h3>
          {invitations.length === 0 ? <p className="muted">None.</p> : (
            <ul className="list">
              {invitations.map((inv) => (
                <li key={inv.id}>
                  {inv.email} as {inv.role}
                  <span className="muted"> · expires {new Date(inv.expires_at).toLocaleDateString()}</span>{" "}
                  <button className="link" onClick={() => void revoke(inv.id)}>Revoke</button>
                </li>
              ))}
            </ul>
          )}
          <Invite client={client} organisationId={organisationId} onInvited={() => void load()} />
        </>
      )}
    </section>
  );
}

function Invite({ client, organisationId, onInvited }: {
  client: SupabaseClient;
  organisationId: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(null);
    const address = email.trim().toLowerCase();
    const { error: failure } = await client
      .from("invitation")
      .insert({ organisation_id: organisationId, email: address, role });
    if (failure) {
      setError(failure.code === "23505" ? `${address} already has a pending invitation — revoke it first to re-send.` : failure.message);
      return;
    }
    setSent(address);
    setEmail("");
    onInvited();
  }

  return (
    <section className="card">
      <h3>Invite someone</h3>
      <form onSubmit={submit} className="stack">
        <div className="grid">
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">admin — manages members and details</option>
              <option value="member">member — adds and edits products</option>
              <option value="viewer">viewer — read only</option>
            </select>
          </label>
        </div>
        <button type="submit">Invite</button>
        {error && <p className="error" role="alert">{error}</p>}
        {sent && (
          <p className="notice">
            Invitation created for <strong>{sent}</strong>. They accept it by signing in to this app
            with that address — the invitation is waiting for them there. (An invitation email is
            sent once the app's mail domain is set up; until then, let them know.)
          </p>
        )}
      </form>
    </section>
  );
}
