/**
 * Markets the public scanner offers: the v1 EPR scope from `02-` §5.2, Ireland (D-062), and the UK. Its own
 * module so tests can read it without running the build. The web app's readiness list
 * (apps/web/src/domain/markets.ts) must match it, and every market here must have at least one
 * published national requirement — both enforced by test/markets.test.ts, and the second also
 * by build.ts.
 */
export const MARKETS = [
  { iso: "DE", name: "Germany" },
  { iso: "FR", name: "France" },
  { iso: "ES", name: "Spain" },
  { iso: "IT", name: "Italy" },
  { iso: "NL", name: "Netherlands" },
  { iso: "AT", name: "Austria" },
  { iso: "BE", name: "Belgium" },
  { iso: "IE", name: "Ireland" },
  { iso: "GB", name: "United Kingdom" },
] as const;
