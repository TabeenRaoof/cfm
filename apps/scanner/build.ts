/**
 * Builds the public scanner into `dist/` as static files: one HTML page, one JS bundle, one
 * stylesheet, and one catalog slice per market.
 *
 * The output is deployable to any static host. Nothing here runs on a server, which is the
 * point: the visitor's spreadsheet never leaves their machine, so the scanner processes no
 * personal data and cannot be made to spend money (decisions.md D-009, D-013, D-020).
 *
 * Two safeguards, because a build that silently ships the wrong catalog is worse than one that
 * fails:
 *   - Drafts are excluded unless --include-drafts is passed, and a draft build stamps a banner
 *     into the page so a preview can never be mistaken for the real thing.
 *   - A build producing zero requirements for a market fails rather than deploying a page that
 *     tells every seller they are fine.
 */

import { readFile, mkdir, rm, writeFile, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import { sliceForMarket } from "@cfm/catalog";
import { loadCatalogFromDir } from "@cfm/catalog/node";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(appRoot, "..", "..");
const dist = join(appRoot, "dist");

/** Markets offered at launch: the v1 EPR scope from 02- §5.2, plus the UK. */
export const MARKETS = [
  { iso: "DE", name: "Germany" },
  { iso: "FR", name: "France" },
  { iso: "ES", name: "Spain" },
  { iso: "IT", name: "Italy" },
  { iso: "NL", name: "Netherlands" },
  { iso: "AT", name: "Austria" },
  { iso: "BE", name: "Belgium" },
  { iso: "GB", name: "United Kingdom" },
] as const;

const includeDrafts = process.argv.includes("--include-drafts");

/**
 * Where the waitlist form posts. Set WAITLIST_ACTION to the hosted form endpoint of whichever
 * email platform is chosen (decisions.md D-024) — it is one environment variable precisely so
 * that switching platform is not a code change.
 *
 * Unset, the form renders visibly disabled rather than silently discarding addresses. A signup
 * box that looks like it worked and did not is worse than no signup box.
 */
const waitlistAction = process.env.WAITLIST_ACTION ?? "";

/**
 * Identity details for the privacy notice. A privacy notice shipped with "[YOUR ADDRESS]" in it
 * is worse than none — it tells every reader the operator was not paying attention — so a
 * production build refuses while any of these is unset. A draft preview is allowed through with
 * a warning, so the page can be read and edited before the details exist.
 */
const CONTROLLER = {
  __CONTROLLER_NAME__: process.env.CONTROLLER_NAME ?? "",
  __CONTROLLER_ADDRESS__: process.env.CONTROLLER_ADDRESS ?? "",
  __CONTACT_EMAIL__: process.env.CONTACT_EMAIL ?? "",
} as const;

const WAITLIST_NOT_CONFIGURED = `<div class="banner" role="alert">
  <strong>Not wired up yet.</strong> No email platform has been configured, so this form is
  disabled rather than quietly discarding addresses. Set <code>WAITLIST_ACTION</code> at build
  time. See <code>apps/scanner/README.md</code>.
</div>
<form><fieldset disabled>
  <label class="field"><span>Your email</span><input type="email" placeholder="you@yourbrand.com"></label>
  <p><button type="submit" class="submit">Send me the digest</button></p>
</fieldset></form>`;


const DRAFT_BANNER = `<div class="banner" role="alert">
  <strong>Draft build.</strong> These requirements have not been reviewed against their primary
  sources yet. Do not publish this, and do not rely on the result.
</div>`;


const manifest = JSON.parse(
  await readFile(join(repoRoot, "packages/catalog/catalog.json"), "utf8"),
) as { version: string };

const { catalog, issues, withheldDrafts } = await loadCatalogFromDir(
  join(repoRoot, "packages/catalog/requirements"),
  { version: manifest.version, includeDrafts },
);

if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.file}: ${issue.path} — ${issue.message}`);
  throw new Error(`Catalog has ${issues.length} validation issues; refusing to build.`);
}

if (catalog.requirements.length === 0) {
  throw new Error(
    includeDrafts
      ? "No requirements at all."
      : `No requirement is published yet (${withheldDrafts.length} drafts withheld), so the ` +
        `scanner would tell every seller they have nothing to do. Review requirements against ` +
        `their primary sources first — see packages/catalog/sources.md — or use ` +
        `\`npm run build:preview\` for a clearly-marked draft build.`,
  );
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "catalog"), { recursive: true });

// One file per market. A scraper has to enumerate markets rather than press save once; that is
// a speed bump and not a secret, and the README says so plainly.
const index: { iso: string; name: string; requirements: number }[] = [];
for (const market of MARKETS) {
  const slice = sliceForMarket(catalog, market.iso);
  if (slice.requirements.length === 0) {
    throw new Error(`Slice for ${market.iso} is empty; that market would show a false all-clear.`);
  }
  await writeFile(join(dist, "catalog", `${market.iso}.json`), JSON.stringify(slice));
  index.push({ iso: market.iso, name: market.name, requirements: slice.requirements.length });
}
await writeFile(join(dist, "catalog", "index.json"), JSON.stringify({ version: catalog.version, markets: index }));

await build({
  entryPoints: [join(appRoot, "src/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: true,
  outfile: join(dist, "app.js"),
  define: { "__DRAFT_BUILD__": String(includeDrafts) },
});

await assertBundleCannotPhoneHome(join(dist, "app.js"));

await cp(join(appRoot, "src/styles.css"), join(dist, "styles.css"));

const html = (await readFile(join(appRoot, "src/index.html"), "utf8"))
  .replace("<!--DRAFT_BANNER-->", includeDrafts ? DRAFT_BANNER : "")
  .replace("<!--MARKET_OPTIONS-->", MARKETS.map(marketCheckbox).join("\n"))
  .replace("__CATALOG_VERSION__", catalog.version);
await writeFile(join(dist, "index.html"), html);

let privacy = (await readFile(join(appRoot, "src/privacy.html"), "utf8")).replace(
  "__PRIVACY_UPDATED__",
  new Date().toISOString().slice(0, 10),
);
const unset = Object.entries(CONTROLLER).filter(([, value]) => value === "");
for (const [token, value] of Object.entries(CONTROLLER)) {
  privacy = privacy.replaceAll(token, value || token);
}
if (unset.length > 0) {
  const names = unset.map(([token]) => token.replace(/^__|__$/g, "")).join(", ");
  if (!includeDrafts) {
    throw new Error(
      `The privacy notice still has unfilled placeholders (${names}). Set CONTROLLER_NAME, ` +
        `CONTROLLER_ADDRESS and CONTACT_EMAIL at build time — a notice published with its ` +
        `placeholders intact is worse than none.`,
    );
  }
  console.log(`  privacy: ${unset.length} placeholder(s) unfilled — preview only`);
}
await writeFile(join(dist, "privacy.html"), privacy);

const waitlist = (await readFile(join(appRoot, "src/waitlist.html"), "utf8")).replace(
  "<!--WAITLIST_FORM-->",
  waitlistAction ? waitlistForm(waitlistAction) : WAITLIST_NOT_CONFIGURED,
);
await writeFile(join(dist, "waitlist.html"), waitlist);
if (!waitlistAction) {
  console.log("  waitlist: no WAITLIST_ACTION set — form rendered disabled (see apps/scanner/README.md)");
}

console.log(`scanner built → apps/scanner/dist`);
console.log(`  catalog ${catalog.version}${includeDrafts ? " (INCLUDING DRAFTS — not for production)" : ""}`);
for (const m of index) console.log(`  ${m.iso}: ${m.requirements} requirements`);

/**
 * The page tells the visitor their file never leaves their computer. That sentence is only
 * true for as long as the bundle contains no way to send it anywhere, so the build checks
 * rather than trusting — a claim about privacy is exactly the kind that decays quietly when
 * someone adds an innocuous analytics call months later.
 *
 * Permitted: fetching a catalog slice by relative path. Nothing else.
 */
async function assertBundleCannotPhoneHome(bundlePath: string): Promise<void> {
  const code = await readFile(bundlePath, "utf8");

  const forbidden = [
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/sendBeacon/, "navigator.sendBeacon"],
    [/new\s+WebSocket/, "WebSocket"],
    [/new\s+EventSource/, "EventSource"],
    [/https?:\/\/(?!www\.w3\.org)/, "an absolute http(s) URL"],
    [/\.submit\s*\(/, "a form submission"],
  ] as const;

  const found = forbidden.filter(([pattern]) => pattern.test(code)).map(([, label]) => label);
  if (found.length > 0) {
    throw new Error(
      `The scanner bundle contains ${found.join(", ")}. This page promises that the visitor's ` +
        `file never leaves their computer; if that is changing deliberately, remove the claim ` +
        `from src/index.html in the same commit.`,
    );
  }

  // The one fetch that is allowed, and only to a relative path.
  for (const match of code.matchAll(/fetch\(([^)]{0,80})/g)) {
    const argument = match[1] ?? "";
    if (!argument.includes("catalog/")) {
      throw new Error(`The bundle fetches something other than a catalog slice: ${argument}`);
    }
  }

  console.log("  privacy check: bundle has no way to transmit the visitor's file ✓");
}

/**
 * A plain HTML form posting straight to the email platform. No JavaScript at all, which is why
 * it can live beside a scanner that promises not to transmit anything: there is no shared code
 * and no shared bundle, and the scanner's privacy check covers app.js only because app.js is
 * the only thing that ever touches the visitor's file.
 */
function waitlistForm(action: string): string {
  return `<form method="post" action="${action}">
      <label class="field">
        <span>Your email</span>
        <input type="email" name="email" required autocomplete="email" placeholder="you@yourbrand.com">
      </label>
      <label class="field">
        <span>Roughly how many SKUs do you sell? (optional)</span>
        <input type="text" name="sku_count" autocomplete="off" placeholder="e.g. 80">
      </label>
      <label class="choice consent">
        <input type="checkbox" name="consent" required>
        <span>Yes, email me the monthly digest and tell me when the product opens. I can unsubscribe at any time.</span>
      </label>
      <p><button type="submit" class="submit">Send me the digest</button></p>
    </form>`;
}


function marketCheckbox(market: { iso: string; name: string }): string {
  return (
    `<label class="choice"><input type="checkbox" name="market" value="${market.iso}"` +
    `${market.iso === "DE" ? " checked" : ""}> ${market.name}</label>`
  );
}
