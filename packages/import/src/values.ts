/**
 * Turning spreadsheet strings into facts.
 *
 * THIS FILE IS THE HARD RULE'S BOUNDARY. Everything upstream of it is a customer's export;
 * everything downstream trusts what comes out. The catalog's three-valued logic is only as
 * honest as this conversion: the moment a blank cell becomes `false` instead of `undefined`,
 * an obligation silently disappears and a SKU turns green. Every function here fails towards
 * `undefined` — "we were not told" — and never towards a decision.
 *
 * See tabeen_AGENTS.md "The hard rule" and packages/catalog/src/facts.ts.
 */

export type FactValue = string | number | boolean | null;

export interface Coerced {
  /** `undefined` means unknown. `null` means the sheet positively said "none". */
  readonly value: FactValue | undefined;
  readonly warning?: string;
}

const UNKNOWN: Coerced = { value: undefined };

/** Spellings that mean "the seller answered, and the answer is nothing". */
const EXPLICIT_NONE = new Set(["none", "n/a", "na", "not applicable", "-", "—", "keine", "aucun"]);

const TRUTHY = new Set(["yes", "y", "true", "t", "1", "x", "ja", "oui", "si", "sì"]);
const FALSY = new Set(["no", "n", "false", "f", "0", "nein", "non"]);

/**
 * Text. A blank cell is unknown, not an empty string: "" would satisfy a required-data check
 * that is really still outstanding.
 */
export function coerceText(raw: string): Coerced {
  const value = raw.trim();
  if (value === "") return UNKNOWN;
  if (EXPLICIT_NONE.has(value.toLowerCase())) return { value: null };
  return { value };
}

/**
 * Booleans, the most dangerous column type in the file.
 *
 * A `has_battery` column with a blank cell is the classic case: the seller filled in the rows
 * that do have batteries and left the rest empty, meaning "no" — or they exported from a system
 * that has no such field at all, meaning "no idea". Those are indistinguishable from here, so
 * both become unknown and the customer gets asked. Guessing "no" would be right most of the
 * time, which is exactly what makes it dangerous: the failures are rare, silent, and land on
 * the SKUs that most needed the requirement.
 */
export function coerceBoolean(raw: string): Coerced {
  const value = raw.trim().toLowerCase();
  if (value === "") return UNKNOWN;
  if (TRUTHY.has(value)) return { value: true };
  if (FALSY.has(value)) return { value: false };
  if (EXPLICIT_NONE.has(value)) return { value: false };
  return {
    value: undefined,
    warning: `"${raw.trim()}" is not a yes/no value, so it was read as unknown rather than guessed.`,
  };
}

/**
 * ISO 3166-1 alpha-2 country codes, plus the English, German and French names most likely to
 * appear in a seller's export. Not exhaustive by design — an unrecognised value becomes
 * unknown with a warning rather than being passed through, because the catalog derives EU
 * membership from this and "Made in PRC" would silently derive as non-EU. Right by accident is
 * still a bug.
 */
const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  china: "CN", "pr china": "CN", prc: "CN", "peoples republic of china": "CN",
  germany: "DE", deutschland: "DE", allemagne: "DE",
  france: "FR", frankreich: "FR",
  italy: "IT", italia: "IT", italien: "IT",
  spain: "ES", espana: "ES", "españa": "ES", spanien: "ES",
  netherlands: "NL", nederland: "NL", holland: "NL", niederlande: "NL",
  belgium: "BE", belgie: "BE", belgique: "BE",
  poland: "PL", polska: "PL",
  austria: "AT", osterreich: "AT", "österreich": "AT",
  ireland: "IE", portugal: "PT", sweden: "SE", denmark: "DK", finland: "FI",
  czechia: "CZ", "czech republic": "CZ", romania: "RO", hungary: "HU", greece: "GR",
  "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB", britain: "GB",
  "united states": "US", usa: "US", "united states of america": "US",
  vietnam: "VN", "viet nam": "VN", india: "IN", turkey: "TR", "türkiye": "TR", turkiye: "TR",
  taiwan: "TW", "hong kong": "HK", japan: "JP", "south korea": "KR", korea: "KR",
  thailand: "TH", indonesia: "ID", malaysia: "MY", bangladesh: "BD", pakistan: "PK",
  cambodia: "KH", mexico: "MX", canada: "CA", switzerland: "CH", norway: "NO",
};

export function coerceCountry(raw: string): Coerced {
  const value = raw.trim();
  if (value === "") return UNKNOWN;
  if (EXPLICIT_NONE.has(value.toLowerCase())) return { value: null };

  if (/^[A-Za-z]{2}$/.test(value)) return { value: value.toUpperCase() };

  const normalised = value.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  const code = COUNTRY_NAMES[normalised];
  if (code) return { value: code };

  return {
    value: undefined,
    warning: `"${value}" was not recognised as a country, so it was read as unknown. Use an ISO code such as CN or DE.`,
  };
}

/** Digits only, length-checked. A malformed barcode is worse than an absent one. */
export function coerceGtin(raw: string): Coerced {
  const value = raw.trim().replace(/[\s-]/g, "");
  if (value === "") return UNKNOWN;
  if (EXPLICIT_NONE.has(value.toLowerCase())) return { value: null };
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) {
    return {
      value: undefined,
      warning: `"${raw.trim()}" is not a valid GTIN/EAN/UPC length (8, 12, 13 or 14 digits).`,
    };
  }
  return { value };
}
