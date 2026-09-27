import { assessProducts, type MarketResult } from "@cfm/scanner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { catalog, catalogIssues } from "./domain/catalog.ts";
import { factLabel, ORGANISATION_FACT_PREFIXES, subjectFacts } from "./domain/facts.ts";
import { MARKETS, marketName } from "./domain/markets.ts";
import { CAN_MANAGE, PRODUCT_COLUMNS, type Organisation, type Product, type Role } from "./lib/types.ts";

/**
 * Readiness per product × market: the same deterministic assessment as the public scanner
 * (`assessProducts` from @cfm/scanner, over `assessProduct` from @cfm/catalog), fed with this
 * organisation's stored facts instead of a one-off CSV. Derived in the browser and never stored —
 * a client can't write itself a "met" (D-050).
 */
export function Readiness({ client, organisation, role, onChanged }: {
  client: SupabaseClient;
  organisation: Organisation;
  role: Role;
  onChanged: () => void;
}) {
  const [products, setProducts] = useState<readonly Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await client
      .from("product")
      .select(PRODUCT_COLUMNS)
      .eq("organisation_id", organisation.id)
      .order("sku");
    if (failure) setError(failure.message);
    else setProducts((data ?? []) as Product[]);
  }, [client, organisation.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const asOf = new Date().toISOString().slice(0, 10);
  const markets = organisation.target_markets;

  const result = useMemo(() => {
    if (!products || markets.length === 0 || catalogIssues.length > 0) return null;
    const items = products.map((product) => ({ product, facts: subjectFacts(organisation, product) }));
    return assessProducts(items, { catalog, markets, asOf });
  }, [products, organisation, markets, asOf]);

  if (catalogIssues.length > 0) {
    return (
      <p className="error" role="alert">
        The requirement catalog failed validation in this build, so readiness is withheld rather than
        shown wrong. ({catalogIssues.length} issue(s) — see `npm run catalog:check`.)
      </p>
    );
  }

  return (
    <section>
      <h2>Readiness</h2>
      <TargetMarkets client={client} organisation={organisation} role={role} onChanged={onChanged} />
      {error && <p className="error" role="alert">{error}</p>}
      {markets.length === 0 && <p className="muted">Choose the markets you sell into to see readiness.</p>}
      {products?.length === 0 && markets.length > 0 && (
        <p className="muted">No products yet — import a spreadsheet on the Products tab.</p>
      )}

      {result && result.products.length > 0 && (
        <>
          <Summary total={result.products.length} ready={result.products.filter((p) => p.ready).length}
            blocked={result.products.filter((p) => p.markets.some((m) => m.blocking.length > 0)).length}
            undetermined={result.products.filter((p) => p.markets.some((m) => m.unresolved.length > 0)).length} />

          {result.questions.length > 0 && (
            <section className="card">
              <h3>Answer these first</h3>
              <p className="muted">
                Each one decides requirements we currently can't — ordered by how many product-market
                checks it unblocks.
              </p>
              <ol>
                {result.questions.slice(0, 8).map((q) => {
                  const orgLevel = ORGANISATION_FACT_PREFIXES.some((p) => q.factPath.startsWith(`${p}.`));
                  return (
                    <li key={q.factPath}>
                      <strong>{factLabel(q.factPath, catalog)}</strong>
                      <span className="muted"> · unblocks {q.unblocks} · </span>
                      {orgLevel || q.factPath === "organisation.establishment_country" ? (
                        <a href={`#org=${organisation.id}&tab=details`}>answer in Organisation details</a>
                      ) : (
                        <span className="muted">add a column for it to your product sheet and re-import</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  {markets.map((m) => <th key={m}>{marketName(m)}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.products.map(({ item, markets: cells }) => (
                  <tr key={item.product.id}>
                    <td>
                      <details>
                        <summary>{item.product.sku}</summary>
                        <CellDetails cells={cells} />
                      </details>
                    </td>
                    {cells.map((cell) => <td key={cell.market}><CellSummary cell={cell} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="muted small">
        Catalog {catalog.version}, assessed {asOf}. An information tool, not legal advice or
        certification — every requirement cites its source; check it against your own situation.
      </p>
    </section>
  );
}

function Summary({ total, ready, blocked, undetermined }: { total: number; ready: number; blocked: number; undetermined: number }) {
  return (
    <div className="stats">
      <div className="stat"><b>{total}</b><span>products</span></div>
      <div className="stat ok"><b>{ready}</b><span>ready in every market</span></div>
      <div className="stat bad"><b>{blocked}</b><span>with something outstanding</span></div>
      <div className="stat unknown"><b>{undetermined}</b><span>we can't decide yet</span></div>
    </div>
  );
}

function CellSummary({ cell }: { cell: MarketResult }) {
  if (cell.ready) return <span className="ok">Ready</span>;
  return (
    <>
      {cell.blocking.length > 0 && <span className="bad">{cell.blocking.length} outstanding</span>}
      {cell.blocking.length > 0 && cell.unresolved.length > 0 && <br />}
      {cell.unresolved.length > 0 && <span className="unknown">{cell.unresolved.length} undetermined</span>}
    </>
  );
}

function CellDetails({ cells }: { cells: readonly MarketResult[] }) {
  return (
    <div className="cell-details">
      {cells.map((cell) => (
        <div key={cell.market}>
          <h4>{marketName(cell.market)}</h4>
          {cell.ready && <p className="ok">Nothing outstanding.</p>}
          <ul className="list">
            {cell.blocking.map((a) => (
              <li key={a.requirement_id}>
                <span className="bad">{a.status}</span> — {a.title} <span className="muted">({a.article_ref})</span>
              </li>
            ))}
            {cell.unresolved.map((a) => (
              <li key={a.requirement_id}>
                <span className="unknown">can't decide</span> — {a.title}
                <span className="muted"> · needs: {a.missing_facts.map((f) => factLabel(f, catalog)).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TargetMarkets({ client, organisation, role, onChanged }: {
  client: SupabaseClient;
  organisation: Organisation;
  role: Role;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const canEdit = CAN_MANAGE.includes(role);

  async function toggle(iso: string) {
    setError(null);
    const current = new Set(organisation.target_markets);
    if (current.has(iso)) current.delete(iso);
    else current.add(iso);
    const next = MARKETS.map((m) => m.iso).filter((m) => current.has(m));
    const { error: failure } = await client.from("organisation").update({ target_markets: next }).eq("id", organisation.id);
    if (failure) setError(failure.message);
    else onChanged();
  }

  return (
    <fieldset className="choices plain" disabled={!canEdit}>
      <legend className="muted">Markets you sell into{!canEdit && " (owners and admins can change these)"}</legend>
      {MARKETS.map((m) => (
        <label key={m.iso} className="choice">
          <input type="checkbox" checked={organisation.target_markets.includes(m.iso)} onChange={() => void toggle(m.iso)} />
          {" "}{m.name}
        </label>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
    </fieldset>
  );
}
