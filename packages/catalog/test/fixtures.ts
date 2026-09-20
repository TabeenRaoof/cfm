import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildResult } from "../src/catalog.ts";
import { loadCatalogFromDir } from "../src/node.ts";
import type { FactBag } from "../src/facts.ts";

export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const AS_OF = "2026-09-12";

export async function loadRealCatalog(includeDrafts: boolean): Promise<BuildResult> {
  const manifest = JSON.parse(await readFile(join(packageRoot, "catalog.json"), "utf8")) as {
    version: string;
  };
  return loadCatalogFromDir(join(packageRoot, "requirements"), {
    version: manifest.version,
    includeDrafts,
  });
}

/**
 * A SKU about which we know everything the catalog could ask: a battery-powered toy in
 * retail packaging, made in China, sold by a UK company into Germany through Amazon.
 *
 * Chosen because it makes almost every requirement in the catalog apply, which is what the
 * hard-rule test needs — you cannot prove that removing a fact fails to produce a false "not
 * applicable" unless the requirement applied in the first place.
 */
export const FULLY_KNOWN: FactBag = {
  "manufacturer.country": "CN",
  "manufacturer.name": "Shenzhen Example Industrial Co., Ltd",
  "manufacturer.address": "1 Example Road, Shenzhen, China",

  "organisation.establishment_country": "GB",
  "organisation.legal_name": "Example Brands Ltd",
  "organisation.trade_register_number": "12345678",
  "organisation.vat_number": "GB123456789",
  "organisation.sells_direct_to_end_users": true,

  "product.has_packaging": true,
  "product.is_toy": true,
  "product.has_battery": true,
  "product.gtin": "5012345678900",
  "product.category_code": "toys",
  "product.battery_producer_registration_number": "DE-BATT-0001",

  "packaging.producer_registration_number": "DE-PACK-0001",
  "packaging.authorised_representative_name": "Example AR GmbH",
  "packaging.lucid_number": "DE1234567890123",
  "packaging.fr_unique_identifier": "FR000000_00ABCD",

  "rp.name": "Example EU Rep GmbH",
  "rp.address": "1 Beispielstraße, 10115 Berlin, Germany",
  "rp.contact": "rp@example.com",
  "rp.uk_name": "Example Brands Ltd",
  "rp.uk_address": "1 Example Street, London, UK",
};

export function without(bag: FactBag, key: string): FactBag {
  const copy: Record<string, FactBag[string]> = { ...bag };
  delete copy[key];
  return copy;
}
