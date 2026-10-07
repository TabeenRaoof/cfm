import type { FactValue } from "@cfm/catalog";
import { schemaFor, type FieldValue } from "@cfm/documents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { catalog } from "./domain/catalog.ts";
import { proposeFacts } from "./domain/document-facts.ts";
import {
  DOCUMENT_COLUMNS,
  EXTRACTION_COLUMNS,
  latestExtractions,
  type DocumentRow,
  type ExtractionRow,
  type LinkRow,
} from "./domain/evidence.ts";
import { api, apiError, saveBlob } from "./lib/api.ts";
import { CAN_EDIT_PRODUCTS, CAN_MANAGE, type Organisation, type Product, type Role } from "./lib/types.ts";

const TYPE_LABELS: Readonly<Record<string, string>> = {
  rp_mandate: "Responsible-person mandate",
  epr_certificate: "EPR registration certificate",
};

const STATUS_LABELS: Readonly<Record<DocumentRow["status"], string>> = {
  queued: "Waiting to be read",
  processing: "Reading…",
  accepted: "Accepted",
  needs_review: "Needs your review",
  failed: "Couldn't be read",
};

/**
 * Supplier documents (D-051). Uploading, reading and accepting all happen on the server — this
 * screen can't write a document or an extraction, only ask the Worker and show what it decided.
 * Which products a document covers, and applying its details as facts, are the seller's own
 * statements, written directly under RLS and audited.
 */
export function Documents({ client, organisation, role, onChanged }: {
  client: SupabaseClient;
  organisation: Organisation;
  role: Role;
  onChanged: () => void;
}) {
  const [documents, setDocuments] = useState<readonly DocumentRow[] | null>(null);
  const [extractions, setExtractions] = useState<readonly ExtractionRow[]>([]);
  const [links, setLinks] = useState<readonly LinkRow[]>([]);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canEdit = CAN_EDIT_PRODUCTS.includes(role);

  const load = useCallback(async () => {
    const [docs, ext, lnk, prod] = await Promise.all([
      client.from("document").select(DOCUMENT_COLUMNS).eq("organisation_id", organisation.id).order("created_at", { ascending: false }),
      client.from("extraction").select(EXTRACTION_COLUMNS).eq("organisation_id", organisation.id),
      client.from("document_product").select("document_id, product_id").eq("organisation_id", organisation.id),
      client.from("product").select("id, sku, title, facts").eq("organisation_id", organisation.id).order("sku"),
    ]);
    const failure = docs.error ?? ext.error ?? lnk.error ?? prod.error;
    if (failure) {
      setError(failure.message);
      return;
    }
    setDocuments((docs.data ?? []) as DocumentRow[]);
    setExtractions((ext.data ?? []) as ExtractionRow[]);
    setLinks((lnk.data ?? []) as LinkRow[]);
    setProducts((prod.data ?? []) as Product[]);
  }, [client, organisation.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is still being read, check back every few seconds.
  const pending = documents?.some((d) => d.status === "queued" || d.status === "processing") ?? false;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void load(), 3_000);
    return () => clearInterval(timer);
  }, [pending, load]);

  const latest = useMemo(() => latestExtractions(extractions), [extractions]);
  const refresh = () => {
    void load();
    onChanged();
  };

  return (
    <section>
      <h2>Documents</h2>
      <p className="muted">
        Upload the mandate or certificate you have. It's read automatically; anything we can't read
        with confidence comes back to you to check. Only accepted documents count as evidence.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {canEdit && <Upload client={client} organisationId={organisation.id} products={products} onUploaded={refresh} />}
      {documents === null && !error && <p>Loading…</p>}
      {documents?.length === 0 && <p className="muted">No documents yet.</p>}
      {documents && documents.length > 0 && (
        <ul className="doc-list">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              client={client}
              organisation={organisation}
              role={role}
              doc={doc}
              extraction={latest.get(doc.id) ?? null}
              linkedProductIds={links.filter((l) => l.document_id === doc.id).map((l) => l.product_id)}
              products={products}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Upload({ client, organisationId, products, onUploaded }: {
  client: SupabaseClient;
  organisationId: string;
  products: readonly Product[];
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !docType || chosen.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    form.set("organisation_id", organisationId);
    form.set("doc_type", docType);
    for (const id of chosen) form.append("product_id", id);
    const response = await api(client, "/api/documents", { method: "POST", body: form });
    setBusy(false);
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    setMessage(`Uploaded ${file.name} — it's being read now.`);
    setFile(null);
    setDocType("");
    setChosen(new Set());
    (event.target as HTMLFormElement).reset();
    onUploaded();
  }

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  const canSubmit = !busy && file !== null && docType !== "" && chosen.size > 0;

  return (
    <section className="card">
      <h3>Upload a document</h3>
      <form onSubmit={submit} className="stack">
        <div className="grid">
          <label className="field">
            <span>What is it?</span>
            <select required value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="" disabled>Select a document type</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label
            className={`field dropzone${dragging ? " dropzone-active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span>File (PDF, PNG or JPEG, up to 10 MB) — drag and drop, or choose a file</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <small className="muted">Selected: {file.name}</small>}
          </label>
        </div>
        {products.length > 0 ? (
          <fieldset className="choices plain">
            <legend className="muted">Which products does it cover? (you can change this later)</legend>
            {products.map((p) => (
              <label key={p.id} className="choice">
                <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} /> {p.sku}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="muted">Add a product first — a document needs at least one to cover.</p>
        )}
        <button type="submit" disabled={!canSubmit}>{busy ? "Uploading…" : "Upload"}</button>
        {!busy && file && docType !== "" && chosen.size === 0 && products.length > 0 && (
          <p className="muted">Choose at least one product above before uploading.</p>
        )}
        {!busy && file && docType === "" && (
          <p className="muted">Select what kind of document this is before uploading.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="notice">{message}</p>}
      </form>
    </section>
  );
}

function DocumentCard({ client, organisation, role, doc, extraction, linkedProductIds, products, onChanged }: {
  client: SupabaseClient;
  organisation: Organisation;
  role: Role;
  doc: DocumentRow;
  extraction: ExtractionRow | null;
  linkedProductIds: readonly string[];
  products: readonly Product[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canEdit = CAN_EDIT_PRODUCTS.includes(role);
  const canManage = CAN_MANAGE.includes(role);
  const proposals = extraction ? proposeFacts(doc.doc_type, extraction.verdict, catalog) : [];

  async function run(work: () => Promise<string | null>) {
    setError(null);
    setNotice(null);
    const failure = await work();
    if (failure) setError(failure);
    onChanged();
  }

  const toggleProduct = (productId: string, linked: boolean) =>
    run(async () => {
      const result = linked
        ? await client.from("document_product").delete().eq("document_id", doc.id).eq("product_id", productId)
        : await client.from("document_product").insert({ document_id: doc.id, product_id: productId, organisation_id: organisation.id });
      return result.error?.message ?? null;
    });

  const download = () =>
    run(async () => {
      const response = await api(client, `/api/documents/${doc.id}/file`);
      if (!response.ok) return apiError(response);
      saveBlob(await response.blob(), doc.filename);
      return null;
    });

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete ${doc.filename}? The file and what was read from it are removed.`)) return null;
      const response = await api(client, `/api/documents/${doc.id}`, { method: "DELETE" });
      return response.ok ? null : apiError(response);
    });

  const applyDetails = () =>
    run(async () => {
      const productScoped = proposals.filter((p) => p.scope === "product");
      const orgScoped = proposals.filter((p) => p.scope === "organisation");
      for (const productId of productScoped.length > 0 ? linkedProductIds : []) {
        const current = products.find((p) => p.id === productId)?.facts ?? {};
        const facts: Record<string, FactValue> = { ...current };
        for (const p of productScoped) facts[p.path] = p.value;
        const { error: failure } = await client.from("product").update({ facts }).eq("id", productId);
        if (failure) return failure.message;
      }
      if (orgScoped.length > 0) {
        const facts: Record<string, FactValue> = { ...organisation.facts };
        for (const p of orgScoped) facts[p.path] = p.value;
        const { error: failure } = await client.from("organisation").update({ facts }).eq("id", organisation.id);
        if (failure) return failure.message;
      }
      setNotice("Details applied.");
      return null;
    });

  return (
    <li className="card doc-card">
      <div className="doc-head">
        <strong>{doc.filename}</strong>
        <span className="muted"> · {TYPE_LABELS[doc.doc_type] ?? doc.doc_type} · {new Date(doc.created_at).toLocaleDateString()}</span>
        <span className={`badge status-${doc.status}`}>{STATUS_LABELS[doc.status]}</span>
      </div>
      {doc.error && <p className="muted">{doc.error}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {extraction && (
        <details open={doc.status === "needs_review"}>
          <summary>
            What we read
            {extraction.source === "human" ? " (entered by a person)" : extraction.used_model ? " (read automatically)" : " (read from the text)"}
          </summary>
          {extraction.verdict.reasons.length > 0 && (
            <ul className="list">{extraction.verdict.reasons.map((r, i) => <li key={i} className="unknown">{r}</li>)}</ul>
          )}
          <table>
            <tbody>
              {extraction.verdict.fields.map((f) => (
                <tr key={f.key}>
                  <td>{f.label}{f.required && " *"}</td>
                  <td className={f.value === null ? "unknown" : ""}>{formatValue(f.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {canEdit && (doc.status === "needs_review" || doc.status === "accepted") && (
        <Review client={client} doc={doc} extraction={extraction} onReviewed={onChanged} />
      )}

      <details>
        <summary>Covers {linkedProductIds.length} product{linkedProductIds.length === 1 ? "" : "s"}</summary>
        {products.length === 0 ? <p className="muted">No products yet.</p> : (
          <fieldset className="choices plain" disabled={!canEdit}>
            {products.map((p) => {
              const linked = linkedProductIds.includes(p.id);
              return (
                <label key={p.id} className="choice">
                  <input type="checkbox" checked={linked} onChange={() => void toggleProduct(p.id, linked)} /> {p.sku}
                </label>
              );
            })}
          </fieldset>
        )}
      </details>

      {canEdit && doc.status === "accepted" && proposals.length > 0 && (
        <div className="stack">
          <p className="muted">
            This document states details the requirements also ask for:{" "}
            {proposals.map((p) => `${p.label}: ${p.value}`).join("; ")}.
            {proposals.some((p) => p.scope === "product") && linkedProductIds.length === 0 && " Link it to products first."}
            {proposals.some((p) => p.scope === "organisation") && !canManage && " Organisation details can only be changed by owners and admins."}
          </p>
          <button type="button" onClick={() => void applyDetails()}>Use these details</button>
        </div>
      )}

      <p className="doc-actions">
        <button type="button" className="link" onClick={() => void download()}>Download original</button>
        {canManage && <> · <button type="button" className="link" onClick={() => void remove()}>Delete</button></>}
      </p>
    </li>
  );
}

function formatValue(value: FieldValue): string {
  if (value === null) return "Not found";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function Review({ client, doc, extraction, onReviewed }: {
  client: SupabaseClient;
  doc: DocumentRow;
  extraction: ExtractionRow | null;
  onReviewed: () => void;
}) {
  const schema = schemaFor(doc.doc_type);
  const initial = Object.fromEntries(
    (schema?.fields ?? []).map((f) => {
      const value = extraction?.verdict.fields.find((x) => x.key === f.key)?.value ?? null;
      return [f.key, value === null ? "" : Array.isArray(value) ? value.join(", ") : String(value)];
    }),
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!schema) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const typed: Record<string, FieldValue> = {};
    for (const field of schema!.fields) {
      const raw = (values[field.key] ?? "").trim();
      if (raw === "") continue;
      typed[field.key] = field.kind === "string_array" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : raw;
    }
    const response = await api(client, `/api/documents/${doc.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: typed }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    onReviewed();
  }

  return (
    <details open={doc.status === "needs_review"}>
      <summary>{doc.status === "needs_review" ? "Check and complete the details" : "Correct the details"}</summary>
      <form onSubmit={submit} className="stack">
        <div className="grid">
          {schema.fields.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}{field.required && " *"}</span>
              <input
                value={values[field.key] ?? ""}
                placeholder={field.kind === "date" ? "YYYY-MM-DD" : field.kind === "country" ? "ISO code, e.g. DE" : ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="muted small">
          The same checks apply to what you type as to what was read automatically — dates must be
          real dates, countries ISO codes, and every starred field filled in.
        </p>
        <button type="submit" disabled={busy}>{busy ? "Checking…" : "Accept these details"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </details>
  );
}
