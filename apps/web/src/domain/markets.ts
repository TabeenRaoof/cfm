/**
 * Markets offered for readiness — the same set the public scanner offers (apps/scanner/build.ts
 * MARKETS): the v1 EPR scope from `02-` §5.2, plus the UK. Kept in step by hand; if they diverge,
 * a seller would see a market in one tool that the other can't assess.
 */
export const MARKETS: readonly { readonly iso: string; readonly name: string }[] = [
  { iso: "DE", name: "Germany" },
  { iso: "FR", name: "France" },
  { iso: "ES", name: "Spain" },
  { iso: "IT", name: "Italy" },
  { iso: "NL", name: "Netherlands" },
  { iso: "AT", name: "Austria" },
  { iso: "BE", name: "Belgium" },
  { iso: "GB", name: "United Kingdom" },
];

export const marketName = (iso: string) => MARKETS.find((m) => m.iso === iso)?.name ?? iso;
