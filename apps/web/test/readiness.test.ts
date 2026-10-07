/**
 * Readiness in the app is the scanner's assessment over stored facts (src/Readiness.tsx, D-050).
 * These tests hold the two tools to giving the same answer from the same facts — the scanner is
 * the public proof of the product, and an app that disagreed with it would undo that.
 */

import { readFile } from "node:fs/promises";
import { importProducts } from "@cfm/import";
import { assessProducts, scan } from "@cfm/scanner";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { catalog } from "../src/domain/catalog.ts";
import { subjectFacts, toImportRows, type ProductRow } from "../src/domain/facts.ts";
import { MARKETS, SALES_CHANNEL_FACT, SALES_CHANNELS, salesChannelOf } from "../src/domain/markets.ts";
import { as, createDatabase, createUser, user } from "./support/db.ts";

const CSV = [
  "SKU,Title,Has battery,Electrical,Toy,Packaging,Country of origin,Manufacturer,Manufacturer address,Responsible person,GTIN",
  "K-1,Kettle,no,yes,no,yes,CN,Shenzhen Co,1 Road Shenzhen,EU Rep GmbH,4006381333931",
  "T-1,Toy robot,yes,yes,yes,yes,,,,,",
  "B-1,Blank,,,,,,,,,",
].join("\n");
const ASOF = "2026-09-26";

describe("markets", () => {
  it("the app offers exactly the scanner's markets", async () => {
    const build = await readFile(new URL("../../scanner/build.ts", import.meta.url), "utf8");
    const scannerIsos = [...build.matchAll(/\{ iso: "([A-Z]{2})"/g)].map((m) => m[1]);
    expect(MARKETS.map((m) => m.iso)).toEqual(scannerIsos);
  });
});

describe("sales channel", () => {
  it("the app offers exactly the scanner's sales channels", async () => {
    const html = await readFile(new URL("../../scanner/src/index.html", import.meta.url), "utf8");
    const select = /<select id="channel">([\s\S]*?)<\/select>/.exec(html)![1]!;
    const scannerValues = [...select.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    expect([...SALES_CHANNELS.map((c) => c.value), ""]).toEqual(scannerValues);
  });

  it("only a known channel becomes the assessment's channel", () => {
    expect(salesChannelOf({ [SALES_CHANNEL_FACT]: "amazon" })).toBe("amazon");
    expect(salesChannelOf({ [SALES_CHANNEL_FACT]: "myspace" })).toBeUndefined();
    expect(salesChannelOf({})).toBeUndefined();
  });

  it("choosing one decides the marketplace requirements that were undetermined", () => {
    const facts = { "product.has_packaging": true, "manufacturer.country": "CN" } as const;
    const statusOf = (channel?: string) =>
      assessProducts([{ facts }], { catalog, markets: ["DE"], asOf: ASOF, ...(channel ? { channel } : {}) })
        .products[0]!.markets[0]!;
    const trader = (cell: ReturnType<typeof statusOf>) =>
      [...cell.blocking, ...cell.unresolved].find((a) => a.requirement_id === "eu.dsa.trader-information");

    const unset = statusOf();
    expect(trader(unset)?.status).toBe("unknown");
    expect(trader(unset)?.missing_facts).toEqual(["channel.type"]);
    expect(trader(statusOf("amazon"))?.status).not.toBe("unknown");
    expect(trader(statusOf("shopify"))).toBeUndefined(); // own shop: doesn't apply, so not listed
  });
});

describe("same facts, same answer as the scanner", () => {
  let db: PGlite;
  const OWNER = "a0000000-0000-4000-8000-000000000001";
  let stored: ProductRow[];

  beforeAll(async () => {
    db = await createDatabase();
    await createUser(db, OWNER, "owner@acme.test");
    const org = await as(db, user(OWNER), async (tx) =>
      (await tx.query<{ id: string }>("select public.create_organisation('Acme') as id")).rows[0]!.id,
    { commit: true });
    const { rows } = toImportRows(importProducts(CSV, { maxRows: 100 }));
    await as(db, user(OWNER), (tx) =>
      tx.query("select * from public.import_products($1, $2::jsonb)", [org, JSON.stringify(rows)]),
    { commit: true });
    stored = (await db.query<ProductRow>(
      "select sku, title, brand, category_code, gtin, has_battery, is_electrical, is_toy, has_packaging, manufacturer_country, facts from public.product order by sku",
    )).rows;
  });
  afterAll(async () => {
    await db.close();
  });

  it("every product × market status matches the scanner's for the same CSV", () => {
    const markets = MARKETS.map((m) => m.iso);
    const scanned = scan(CSV, { catalog, markets, asOf: ASOF, maxRows: 100 });
    // An organisation that has told us nothing — the scanner knows nothing about the seller either.
    const app = assessProducts(
      stored.map((product) => ({ product, facts: subjectFacts({ establishment_country: null, facts: {} }, product) })),
      { catalog, markets, asOf: ASOF },
    );

    const statuses = (cells: readonly { market: string; blocking: readonly { requirement_id: string; status: string }[]; unresolved: readonly { requirement_id: string; status: string }[] }[]) =>
      cells.flatMap((c) => [...c.blocking, ...c.unresolved].map((a) => `${c.market}:${a.requirement_id}:${a.status}`)).sort();

    for (const fromScanner of scanned.products) {
      const fromApp = app.products.find((p) => p.item.product.sku === fromScanner.sku)!;
      expect(fromApp, `app is missing ${fromScanner.sku}`).toBeDefined();
      expect(statuses(fromApp.markets)).toEqual(statuses(fromScanner.markets));
      expect(fromApp.ready).toBe(fromScanner.ready);
    }
    expect(app.questions).toEqual(scanned.questions);
  });

  it("what the organisation tells us is used: stating the establishment country removes that question", () => {
    const markets = ["DE", "FR"];
    const assess = (establishment_country: string | null) =>
      assessProducts(
        stored.map((product) => ({ product, facts: subjectFacts({ establishment_country, facts: {} }, product) })),
        { catalog, markets, asOf: ASOF },
      );
    const unstated = assess(null).questions.map((q) => q.factPath);
    const stated = assess("GB").questions.map((q) => q.factPath);
    expect(unstated).toContain("organisation.establishment_country");
    expect(stated).not.toContain("organisation.establishment_country");
  });
});
