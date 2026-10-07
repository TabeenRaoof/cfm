import { CsvTooLargeError, importProducts, templateCsv, type ImportResult } from "@cfm/import";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { toImportRows, type PreparedImport } from "./domain/facts.ts";
import { saveBlob } from "./lib/api.ts";
import { CAN_EDIT_PRODUCTS, PRODUCT_COLUMNS, type Product, type Role, type TriState } from "./lib/types.ts";

const FACTS = [
  ["has_battery", "Contains a battery"],
  ["is_electrical", "Electrical / electronic"],
  ["is_toy", "Toy (under 14s)"],
  ["has_packaging", "Sold with packaging"],
] as const;

type FactKey = (typeof FACTS)[number][0];

/** Matches the database's cap in public.import_products (migration 0002). */
const MAX_IMPORT_ROWS = 5000;

const downloadTemplate = () =>
  saveBlob(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }), "products-template.csv");

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
  const canEdit = CAN_EDIT_PRODUCTS.includes(role);

  const load = useCallback(async () => {
    const { data, error: failure } = await client
      .from("product")
      .select(PRODUCT_COLUMNS)
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
      {products?.length === 0 && <p className="muted">No products yet — import a spreadsheet or add one below.</p>}
      {products && products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Title</th>
                {FACTS.map(([key, label]) => <th key={key}>{label}</th>)}
                <th>Manufacturer country</th>
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
                  <td className={p.manufacturer_country === null ? "unknown" : ""}>{p.manufacturer_country ?? "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <>
          <ImportCsv client={client} organisationId={organisationId} onImported={() => void load()} />
          <AddProduct client={client} organisationId={organisationId} onAdded={() => void load()} />
        </>
      )}
    </section>
  );
}

function ImportCsv({ client, organisationId, onImported }: {
  client: SupabaseClient;
  organisationId: string;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<{ result: ImportResult; prepared: PreparedImport } | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setOutcome(null);
    setParsed(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = importProducts(await file.text(), { maxRows: MAX_IMPORT_ROWS });
      setParsed({ result, prepared: toImportRows(result) });
    } catch (failure) {
      setError(
        failure instanceof CsvTooLargeError
          ? `That file has more than ${MAX_IMPORT_ROWS} rows. Split it and import the parts one after another.`
          : String(failure),
      );
    }
    event.target.value = "";
  }

  async function confirm() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    const { data, error: failure } = await client.rpc("import_products", {
      p_organisation_id: organisationId,
      p_rows: parsed.prepared.rows,
    });
    setBusy(false);
    if (failure) {
      setError(`Nothing was imported — ${failure.message}`);
      return;
    }
    const counts = (data as { inserted: number; updated: number }[])[0];
    setOutcome(`Imported: ${counts?.inserted ?? 0} new, ${counts?.updated ?? 0} updated.`);
    setParsed(null);
    onImported();
  }

  const blocked = parsed && (parsed.result.duplicateSkus.length > 0 || parsed.prepared.rows.length === 0);

  return (
    <section className="card">
      <h3>Import a spreadsheet</h3>
      <p className="muted">
        CSV, one row per SKU — the same file the free scanner reads. Blank cells never erase what we
        already know about a product; a value in the sheet replaces the old one.
      </p>
      <p className="small">
        <button type="button" className="link" onClick={downloadTemplate}>Download a template</button>
        <span className="muted"> — every column we read. Use yes/no for the yes/no columns and a
          two-letter country code (CN, DE…) for countries; leave a cell blank if you don't know.</span>
      </p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => void choose(e)} />
      {error && <p className="error" role="alert">{error}</p>}
      {outcome && <p className="notice">{outcome}</p>}
      {parsed && (
        <div className="stack">
          <p><strong>{parsed.prepared.rows.length}</strong> products ready to import.</p>
          <p className="muted">
            Recognised columns: {parsed.result.mapped.map((m) => m.header).join(", ") || "none"}.
          </p>
          {parsed.result.unmapped.length > 0 && (
            <p className="muted">Ignored columns: {parsed.result.unmapped.join(", ")}.</p>
          )}
          {parsed.prepared.skippedRows.length > 0 && (
            <p className="error">Skipped rows with no SKU: {parsed.prepared.skippedRows.join(", ")}.</p>
          )}
          {parsed.result.duplicateSkus.length > 0 && (
            <p className="error">
              These SKUs appear more than once — fix the sheet first: {parsed.result.duplicateSkus.join(", ")}.
            </p>
          )}
          {parsed.result.warnings.length > 0 && (
            <details>
              <summary>{parsed.result.warnings.length} values were read as unknown</summary>
              <ul className="list">
                {parsed.result.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>Row {w.row}, {w.column}: {w.message}</li>
                ))}
              </ul>
            </details>
          )}
          <button disabled={busy || !!blocked} onClick={() => void confirm()}>
            {busy ? "Importing…" : `Import ${parsed.prepared.rows.length} products`}
          </button>
        </div>
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
