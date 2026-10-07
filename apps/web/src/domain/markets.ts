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

/**
 * Sales channels — the same values the public scanner offers (apps/scanner/src/index.html), so
 * the two tools assess a channel the same way. Marketplace obligations (DSA trader information,
 * listing information) turn on whether the channel is a marketplace (@cfm/catalog facts.ts).
 */
export const SALES_CHANNELS: readonly { readonly value: string; readonly name: string }[] = [
  { value: "amazon", name: "Amazon" },
  { value: "bol", name: "bol.com" },
  { value: "etsy", name: "Etsy" },
  { value: "ebay", name: "eBay" },
  { value: "shopify", name: "My own shop (Shopify, WooCommerce…)" },
];

/** Stored in organisation.facts; not a catalog fact — it becomes the assessment's channel. */
export const SALES_CHANNEL_FACT = "organisation.sales_channel";

export function salesChannelOf(facts: Readonly<Record<string, unknown>>): string | undefined {
  const value = facts[SALES_CHANNEL_FACT];
  return typeof value === "string" && SALES_CHANNELS.some((c) => c.value === value) ? value : undefined;
}
