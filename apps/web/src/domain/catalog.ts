/**
 * The requirement catalog, bundled at build time from packages/catalog/requirements — the same
 * files, the same validation and the same publish gate the scanner and `npm run catalog:check`
 * use. Drafts are excluded (`includeDrafts: false`), so nothing unreviewed reaches a customer.
 *
 * Readiness shown in the app is computed from this and the organisation's facts in the browser:
 * a derived view, never stored, so a client can't write itself a "met". Persisted assessments
 * arrive with evidence linking, computed server-side (D-050).
 */

import { buildCatalog, type Catalog } from "@cfm/catalog";
import manifest from "../../../../packages/catalog/catalog.json";

const files = import.meta.glob<unknown>("../../../../packages/catalog/requirements/*.json", {
  eager: true,
  import: "default",
});

const built = buildCatalog(
  Object.entries(files).map(([file, data]) => ({ file, data })),
  { version: manifest.version, includeDrafts: false },
);

export const catalog: Catalog = built.catalog;
/** Non-empty means a requirement file failed validation — readiness is withheld rather than shown. */
export const catalogIssues = built.issues;
