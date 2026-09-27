import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CAN_EDIT_PRODUCTS, type Product, type Role, type TriState } from "./lib/types.ts";

const FACTS = [
  ["has_battery", "Contains a battery"],
  ["is_electrical", "Electrical / electronic"],
  ["is_toy", "Toy (under 14s)"],
  ["has_packaging", "Sold with packaging"],
] as const;

type FactKey = (typeof FACTS)[number][0];

function showTriState(value: TriState): string {
  if (value === null) return "Unknown";
  return value ? "Yes" : "No";
}

export function Products({ client, organisationId, role }: {
  client: SupabaseClient;
  organisationId: string;
  role: Role;
}) {
  const [products, setProducts] = useState<readonly Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await client
      .from("product")
      .select("id, organisation_id, sku, title, has_battery, is_electrical, is_toy, has_packaging, country_of_origin")
      .eq("organisation_id", organisationId)
      .order("sku");
    if (failure) {
      setError(failure.message);
      return;
    }
    setProducts((data ?? []) as Product[]);
  }, [client, organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h2>Products</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {products === null && !error && <p>Loading…</p>}
      {products?.length === 0 && <p className="muted">No products yet.</p>}
      {products && products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Title</th>
                {FACTS.map(([key, label]) => <th key={key}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.title ?? <span className="muted">—</span>}</td>
                  {FACTS.map(([key]) => (
                    <td key={key} className={p[key] === null ? "unknown" : ""}>{showTriState(p[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {CAN_EDIT_PRODUCTS.includes(role) && (
        <AddProduct client={client} organisationId={organisationId} onAdded={() => void load()} />
      )}
    </section>
  );
}

const TRI_OPTIONS = [["", "Unknown"], ["true", "Yes"], ["false", "No"]] as const;

function parseTriState(value: string): TriState {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function AddProduct({ client, organisationId, onAdded }: {
  client: SupabaseClient;
  organisationId: string;
  onAdded: () => void;
}) {
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  // Every fact starts as "Unknown" — a form default of "No" would answer for the seller.
  const [facts, setFacts] = useState<Record<FactKey, string>>({
    has_battery: "", is_electrical: "", is_toy: "", has_packaging: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await client.from("product").insert({
      organisation_id: organisationId,
      sku: sku.trim(),
      title: title.trim() || null,
      has_battery: parseTriState(facts.has_battery),
      is_electrical: parseTriState(facts.is_electrical),
      is_toy: parseTriState(facts.is_toy),
      has_packaging: parseTriState(facts.has_packaging),
    });
    setBusy(false);
    if (failure) {
      setError(failure.code === "23505" ? `A product with SKU "${sku.trim()}" already exists.` : failure.message);
      return;
    }
    setSku("");
    setTitle("");
    setFacts({ has_battery: "", is_electrical: "", is_toy: "", has_packaging: "" });
    onAdded();
  }

  return (
    <section className="card">
      <h3>Add a product</h3>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>SKU</span>
          <input required maxLength={200} value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid">
          {FACTS.map(([key, label]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <select value={facts[key]} onChange={(e) => setFacts({ ...facts, [key]: e.target.value })}>
                {TRI_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Add product"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
