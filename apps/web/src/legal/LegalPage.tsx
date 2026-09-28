import type { ReactNode } from "react";
import { CONTACT_EMAIL, CONTROLLER_ADDRESS, CONTROLLER_NAME, IN_FORCE, LAST_UPDATED } from "./identity.ts";
import { subprocessors } from "./subprocessors.ts";

/** The frame shared by /privacy and /dpa — public pages, readable without signing in (App.tsx). */
export function LegalPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <main className="page legal">
      <nav className="legal-nav" aria-label="Legal">
        <a href="/">Sign in</a>
        <a href="/privacy">Privacy policy</a>
        <a href="/dpa">Data processing agreement</a>
      </nav>
      <p className="muted small">Last updated {LAST_UPDATED}</p>
      <h1>{title}</h1>
      <p>{lede}</p>
      {!IN_FORCE && (
        <p className="notice" role="note">
          <strong>Draft — not yet in force.</strong> This text is awaiting legal review. No customer
          documents are accepted until it is final.
        </p>
      )}
      {children}
      <p className="muted small">An information tool, not legal advice.</p>
    </main>
  );
}

export function Mailto() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

/** "Tabeen Raoof (postal address available on request — write to …)" */
export function Controller() {
  return (
    <>
      {CONTROLLER_NAME}
      {CONTROLLER_ADDRESS ? (
        <>, {CONTROLLER_ADDRESS}</>
      ) : (
        <> (postal address available on request — write to <Mailto />)</>
      )}
    </>
  );
}

export function SubprocessorTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">What for</th>
            <th scope="col">Where</th>
            <th scope="col">Transfer safeguard</th>
          </tr>
        </thead>
        <tbody>
          {subprocessors().map((processor) => (
            <tr key={processor.name}>
              <th scope="row">{processor.name}</th>
              <td>{processor.purpose}</td>
              <td>{processor.location}</td>
              <td>{processor.safeguard}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
