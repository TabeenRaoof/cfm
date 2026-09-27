/**
 * Establishment countries offered at organisation creation. Short on purpose — the ICP is
 * UK-established (D-033), and the rest are the scanner's markets plus common origins. "Not
 * stated" maps to NULL, which the catalog evaluates as unknown rather than guessing.
 */
export const ESTABLISHMENT_COUNTRIES: readonly { readonly iso: string; readonly name: string }[] = [
  { iso: "GB", name: "United Kingdom" },
  { iso: "IE", name: "Ireland" },
  { iso: "DE", name: "Germany" },
  { iso: "FR", name: "France" },
  { iso: "ES", name: "Spain" },
  { iso: "IT", name: "Italy" },
  { iso: "NL", name: "Netherlands" },
  { iso: "AT", name: "Austria" },
  { iso: "BE", name: "Belgium" },
  { iso: "PL", name: "Poland" },
  { iso: "SE", name: "Sweden" },
  { iso: "US", name: "United States" },
  { iso: "CA", name: "Canada" },
  { iso: "CN", name: "China" },
];
