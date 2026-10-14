/**
 * The markets the public scanner and the web app offer (D-062). A market may only be offered once
 * its national rules are published: its slice is never empty — EU-wide rules see to that — so
 * without this check a market with no national research would show a seller a false all-clear on
 * everything national.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marketSpecificRequirements } from "@cfm/catalog";
import { loadCatalogFromDir } from "@cfm/catalog/node";
import { describe, expect, it } from "vitest";
import { MARKETS as WEB_MARKETS } from "../../web/src/domain/markets.ts";
import { MARKETS } from "../markets.ts";

const catalogRoot = new URL("../../../packages/catalog/", import.meta.url).pathname;
const { version } = JSON.parse(await readFile(join(catalogRoot, "catalog.json"), "utf8")) as { version: string };
const { catalog } = await loadCatalogFromDir(join(catalogRoot, "requirements"), { version, includeDrafts: false });

describe("offered markets", () => {
  it("are the same in the scanner and the web app", () => {
    expect(WEB_MARKETS.map((m) => [m.iso, m.name])).toEqual(MARKETS.map((m) => [m.iso, m.name]));
  });

  it.each(MARKETS.map((m) => m.iso))("%s has at least one published national requirement", (iso) => {
    expect(marketSpecificRequirements(catalog, iso).length).toBeGreaterThan(0);
  });
});
