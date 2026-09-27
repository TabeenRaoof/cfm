import type { FactValue } from "@cfm/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState, type FormEvent } from "react";
import { ESTABLISHMENT_COUNTRIES } from "./countries.ts";
import { catalog } from "./domain/catalog.ts";
import { factFields, ORGANISATION_FACT_PREFIXES, type FactField } from "./domain/facts.ts";
import { CAN_MANAGE, type Organisation, type Role } from "./lib/types.ts";

/**
 * Organisation-level facts, generated from the catalog: every organisation./packaging. fact a
 * published requirement reads, with its kind inferred from how the requirement uses it. Three
 * honest states per fact — unknown (key absent), "we have none" (null), or a value — because the
 * catalog treats them differently and an empty box must never mean "no".
 */

type Entry = { readonly mode: "unknown" | "none" | "value"; readonly value: string };

function toEntry(value: FactValue | undefined): Entry {
  if (value === undefined) return { mode: "unknown", value: "" };
  if (value === null) return { mode: "none", value: "" };
  return { mode: "value", value: String(value) };
}

function fromEntry(field: FactField, entry: Entry): FactValue | undefined {
  if (entry.mode === "unknown") return undefined;
  if (entry.mode === "none") return null;
  if (field.kind === "boolean") return entry.value === "true";
  if (field.kind === "number") {
    const n = Number(entry.value);
    return entry.value.trim() === "" || Number.isNaN(n) ? undefined : n;
  }
  const text = entry.value.trim();
  return text === "" ? undefined : text;
}

export function OrganisationDetails({ client, organisation, role, onSaved }: {
  client: SupabaseClient;
  organisation: Organisation;
  role: Role;
  onSaved: () => void;
}) {
  const fields = useMemo(
    () => factFields(catalog, ORGANISATION_FACT_PREFIXES, ["organisation.establishment_country"]),
    [],
  );
  const [country, setCountry] = useState(organisation.establishment_country ?? "");
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(fields.map((f) => [f.path, toEntry(organisation.facts[f.path])])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = CAN_MANAGE.includes(role);

  const set = (path: string, entry: Entry) => setEntries((current) => ({ ...current, [path]: entry }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    // Facts this form doesn't show are kept as they are; the ones it shows are replaced.
    const facts: Record<string, FactValue> = { ...organisation.facts };
    for (const field of fields) {
      delete facts[field.path];
      const value = fromEntry(field, entries[field.path] ?? { mode: "unknown", value: "" });
      if (value !== undefined) facts[field.path] = value;
    }
    const { error: failure } = await client
      .from("organisation")
      .update({ establishment_country: country || null, facts })
      .eq("id", organisation.id);
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setMessage("Saved.");
    onSaved();
  }

  return (
    <section>
      <h2>Organisation details</h2>
      <p className="muted">
        Everything here is something a published requirement asks about. Leave a field on
        "Unknown" if you don't know — that shows the requirement as undetermined, never as not
        applying. {!canEdit && "Only owners and admins can change these."}
      </p>
      <form onSubmit={submit} className="stack">
        <fieldset disabled={!canEdit || busy} className="stack plain">
          <label className="field">
            <span>Where the business is established</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Not stated yet</option>
              {ESTABLISHMENT_COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid">
            {fields.map((field) => {
              const entry = entries[field.path] ?? { mode: "unknown", value: "" };
              return (
                <label key={field.path} className="field">
                  <span>{field.label}</span>
                  {field.kind === "boolean" ? (
                    <select
                      value={entry.mode === "value" ? entry.value : ""}
                      onChange={(e) => set(field.path, e.target.value ? { mode: "value", value: e.target.value } : { mode: "unknown", value: "" })}
                    >
                      <option value="">Unknown</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <>
                      <input
                        type={field.kind === "number" ? "number" : "text"}
                        value={entry.value}
                        disabled={entry.mode === "none"}
                        placeholder="Unknown"
                        onChange={(e) => set(field.path, e.target.value ? { mode: "value", value: e.target.value } : { mode: "unknown", value: "" })}
                      />
                      {field.kind === "text" && (
                        <small>
                          <label className="inline">
                            <input
                              type="checkbox"
                              checked={entry.mode === "none"}
                              onChange={(e) => set(field.path, e.target.checked ? { mode: "none", value: "" } : { mode: "unknown", value: "" })}
                            />{" "}
                            We don't have one
                          </label>
                        </small>
                      )}
                    </>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
        {canEdit && <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>}
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="notice">{message}</p>}
      </form>
    </section>
  );
}
