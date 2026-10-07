/**
 * Column headers to fact paths.
 *
 * The alias lists are drawn from the three exports the technical plan names — an Amazon
 * inventory report, a Shopify product export, and a plain spreadsheet — and are matched after
 * normalising away case, spaces, underscores and hyphens, because those vary by locale and by
 * which button the seller pressed.
 *
 * Unrecognised columns are reported rather than ignored. A seller whose battery column was
 * called something we do not know needs to be told that, not left wondering why every SKU is
 * asking about batteries.
 */

import type { Coerced } from "./values.ts";
import { coerceBoolean, coerceCountry, coerceGtin, coerceText } from "./values.ts";

export interface ColumnDefinition {
  readonly factPath: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly coerce: (raw: string) => Coerced;
}

export const COLUMNS: readonly ColumnDefinition[] = [
  {
    factPath: "product.sku",
    label: "SKU",
    aliases: ["sku", "sellersku", "itemsku", "variantsku", "productsku", "articlenumber", "artikelnummer", "reference"],
    coerce: coerceText,
  },
  {
    factPath: "product.title",
    label: "Product title",
    aliases: ["title", "itemname", "productname", "producttitle", "name", "description", "bezeichnung"],
    coerce: coerceText,
  },
  {
    factPath: "product.gtin",
    label: "Barcode (GTIN/EAN/UPC)",
    aliases: ["gtin", "ean", "upc", "barcode", "productid", "externalproductid", "eancode", "barcodegtineanupc"],
    coerce: coerceGtin,
  },
  {
    factPath: "product.brand",
    label: "Brand",
    aliases: ["brand", "brandname", "vendor", "marke"],
    coerce: coerceText,
  },
  {
    factPath: "product.category_code",
    label: "Category",
    aliases: ["category", "producttype", "productcategory", "type", "kategorie", "categorie"],
    coerce: coerceText,
  },
  {
    factPath: "manufacturer.name",
    label: "Manufacturer name",
    aliases: ["manufacturer", "manufacturername", "hersteller", "fabricant", "supplier", "suppliername", "factory"],
    coerce: coerceText,
  },
  {
    factPath: "manufacturer.address",
    label: "Manufacturer address",
    aliases: ["manufactureraddress", "herstelleradresse", "supplieraddress"],
    coerce: coerceText,
  },
  {
    factPath: "manufacturer.country",
    label: "Country of manufacture",
    aliases: ["countryoforigin", "countryofmanufacture", "manufacturercountry", "madein", "origin", "originecountry", "herkunftsland", "paysdorigine", "country"],
    coerce: coerceCountry,
  },
  {
    factPath: "product.has_battery",
    label: "Contains a battery",
    aliases: ["battery", "hasbattery", "containsbattery", "containsabattery", "batteries", "batterieincluded", "batterie", "akku"],
    coerce: coerceBoolean,
  },
  {
    factPath: "product.is_toy",
    label: "Is a toy",
    aliases: ["istoy", "isatoy", "toy", "spielzeug", "jouet"],
    coerce: coerceBoolean,
  },
  {
    factPath: "product.is_electrical",
    label: "Is electrical",
    aliases: ["iselectrical", "electrical", "electronic", "elektrisch"],
    coerce: coerceBoolean,
  },
  {
    factPath: "product.has_packaging",
    label: "Has packaging",
    aliases: ["haspackaging", "packaging", "packaged", "verpackung", "emballage"],
    coerce: coerceBoolean,
  },
  {
    factPath: "rp.name",
    label: "EU responsible person",
    aliases: ["responsibleperson", "euresponsibleperson", "rpname", "responsiblepersonname"],
    coerce: coerceText,
  },
  {
    factPath: "rp.address",
    label: "EU responsible person address",
    aliases: ["responsiblepersonaddress", "rpaddress", "euresponsiblepersonaddress"],
    coerce: coerceText,
  },
  {
    factPath: "rp.contact",
    label: "EU responsible person contact",
    aliases: ["responsiblepersonemail", "rpcontact", "rpemail", "responsiblepersoncontact", "euresponsiblepersoncontact"],
    coerce: coerceText,
  },
];

/** A header row with every column the importer reads, in its own words — a blank template. */
export function templateCsv(): string {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return `${COLUMNS.map((c) => cell(c.label)).join(",")}\n`;
}

export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_\-()./]/g, "");
}

const BY_ALIAS: ReadonlyMap<string, ColumnDefinition> = new Map(
  COLUMNS.flatMap((c) => c.aliases.map((a) => [a, c] as const)),
);

export function matchColumn(header: string): ColumnDefinition | undefined {
  return BY_ALIAS.get(normaliseHeader(header));
}
