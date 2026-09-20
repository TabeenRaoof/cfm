/**
 * The free scanner: a spreadsheet in, a per-SKU gap list out, for anyone, with no account.
 *
 * Two properties are load-bearing and both are enforced rather than documented:
 *
 *   1. It is entirely deterministic. No model is called, which is why it is safe to expose
 *      unauthenticated and why the same file always produces the same answer. The package has
 *      no dependency on @cfm/ai at all — see packages/ai/test/boundary.test.ts, which fails the
 *      build if that ever changes. (decisions.md D-009)
 *
 *   2. It is bounded. The row cap is enforced in the CSV reader, before any allocation that
 *      scales with input, because the input size is an anonymous caller's choice.
 *
 * Commercially this is the Gate-2 artefact, so its output is shaped around one question: what
 * is the smallest number of things this seller could tell us that would turn the most red
 * cells green?
 */

import type { Catalog } from "@cfm/catalog";
import { assessProduct, isMarketReady } from "@cfm/catalog";
import type { Assessment } from "@cfm/catalog";
import type { ImportResult } from "@cfm/import";
import { importProducts } from "@cfm/import";

export interface ScanOptions {
  readonly catalog: Catalog;
  /** ISO country codes to assess against. */
  readonly markets: readonly string[];
  readonly channel?: string;
  readonly asOf: string;
  readonly maxRows: number;
}

export interface MarketResult {
  readonly market: string;
  readonly ready: boolean;
  /** Applies, and something concrete is outstanding. */
  readonly blocking: readonly Assessment[];
  /** Cannot even be decided until the seller tells us something. */
  readonly unresolved: readonly Assessment[];
}

export interface ProductResult {
  readonly row: number;
  readonly sku: string | null;
  readonly title: string | null;
  readonly markets: readonly MarketResult[];
  readonly ready: boolean;
}

export interface Question {
  readonly factPath: string;
  /** How many SKU-market cells this one answer would unblock. */
  readonly unblocks: number;
}

export interface ScanReport {
  readonly catalogVersion: string;
  readonly asOf: string;
  readonly markets: readonly string[];
  readonly channel: string | null;
  readonly skusScanned: number;
  readonly skusReady: number;
  readonly skusBlocked: number;
  readonly skusUndecidable: number;
  /** The conversion hook: fewest answers, most cells unblocked, best first. */
  readonly questions: readonly Question[];
  readonly products: readonly ProductResult[];
  readonly diagnostics: Omit<ImportResult, "products">;
}

export function scan(csvText: string, options: ScanOptions): ScanReport {
  const imported = importProducts(csvText, { maxRows: options.maxRows });
  const { products: rows, ...diagnostics } = imported;

  const questionCounts = new Map<string, number>();

  const products: ProductResult[] = rows.map((product) => {
    const markets = options.markets.map((market): MarketResult => {
      const result = assessProduct(
        options.catalog,
        {
          facts: product.facts,
          market: { iso_country: market },
          ...(options.channel ? { channel: { type: options.channel } } : {}),
        },
        { asOf: options.asOf },
      );

      const unresolved = result.assessments.filter((a) => a.status === "unknown");
      const blocking = result.assessments.filter(
        (a) => !isMarketReady(a.status) && a.status !== "unknown",
      );

      // Count one per SKU-market cell, not one per requirement: a seller cares how much of
      // their catalog an answer unlocks, not how many rules mention the field.
      for (const factPath of new Set(unresolved.flatMap((a) => a.missing_facts))) {
        questionCounts.set(factPath, (questionCounts.get(factPath) ?? 0) + 1);
      }

      return { market, ready: result.market_ready, blocking, unresolved };
    });

    return {
      row: product.row,
      sku: product.sku,
      title: product.title,
      markets,
      ready: markets.every((m) => m.ready),
    };
  });

  return {
    catalogVersion: options.catalog.version,
    asOf: options.asOf,
    markets: options.markets,
    channel: options.channel ?? null,
    skusScanned: products.length,
    skusReady: products.filter((p) => p.ready).length,
    skusBlocked: products.filter((p) => p.markets.some((m) => m.blocking.length > 0)).length,
    skusUndecidable: products.filter((p) => p.markets.some((m) => m.unresolved.length > 0)).length,
    questions: [...questionCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([factPath, unblocks]) => ({ factPath, unblocks })),
    products,
    diagnostics,
  };
}
