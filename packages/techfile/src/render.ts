/**
 * The technical file: one self-contained document per SKU per market, showing what applies,
 * what is evidenced, what is outstanding, and what we could not determine — each line carrying
 * the citation it rests on.
 *
 * `02-` §15.4 makes this the bar for 12 December: one design partner has exported a technical
 * file. It is also the artefact a seller would hand to an authority, which sets the tone for
 * everything here:
 *
 *   - It never says the product is compliant. It says what evidence is present and what the
 *     catalog says is required. A test asserts the forbidden words do not appear, because this
 *     is precisely the document where a confident phrase would do the most damage.
 *   - Undetermined requirements get their own section rather than being omitted. A technical
 *     file that quietly drops what it could not decide is worse than one that says so.
 *   - Every requirement shows its source, its article, its review date and its confidence, so
 *     a reader can check us rather than trust us.
 *
 * Output is a single HTML file with print styles, not a PDF. A seller prints to PDF from their
 * browser and gets the same thing, and the package stays dependency-free — no headless browser
 * to run, which matters when one person operates this (`02-` §1, principle 6).
 */

import type { Assessment, ProductAssessment } from "@cfm/catalog";
import { isMarketReady } from "@cfm/catalog";

export interface TechnicalFileInput {
  readonly sku: string;
  readonly title: string | null;
  readonly organisationName: string;
  readonly assessment: ProductAssessment;
  readonly generatedAt: string;
}

export function renderTechnicalFile(input: TechnicalFileInput): string {
  const { assessment } = input;

  const applicable = assessment.assessments.filter((a) => a.status !== "na");
  const undetermined = applicable.filter((a) => a.status === "unknown");
  const outstanding = applicable.filter((a) => !isMarketReady(a.status) && a.status !== "unknown");
  const evidenced = applicable.filter((a) => a.status === "met");
  const excluded = assessment.assessments.filter((a) => a.status === "na");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Technical file — ${esc(input.sku)} — ${esc(assessment.market)}</title>
<style>${STYLES}</style>
</head>
<body>
${coverSheet(input)}
${summary(applicable, evidenced, outstanding, undetermined)}
${undeterminedSection(undetermined)}
${outstandingSection(outstanding)}
${evidencedSection(evidenced)}
${excludedSection(excluded)}
${provenance(input)}
</body>
</html>
`;
}

function coverSheet(input: TechnicalFileInput): string {
  const { assessment } = input;
  return `<header>
  <p class="kicker">Product compliance file · working document</p>
  <h1>${esc(input.title ?? input.sku)}</h1>
  <dl class="meta">
    <div><dt>SKU</dt><dd>${esc(input.sku)}</dd></div>
    <div><dt>Market</dt><dd>${esc(assessment.market)}</dd></div>
    <div><dt>Channel</dt><dd>${esc(assessment.channel ?? "not specified")}</dd></div>
    <div><dt>Held by</dt><dd>${esc(input.organisationName)}</dd></div>
    <div><dt>Generated</dt><dd>${esc(input.generatedAt)}</dd></div>
    <div><dt>Requirement catalog</dt><dd>${esc(assessment.catalog_version)}</dd></div>
  </dl>
</header>`;
}

/**
 * The headline. Deliberately phrased as a count of evidence rather than a verdict — "3 of 9
 * requirements evidenced" is a fact, "70% compliant" is a claim we are not entitled to make.
 */
function summary(
  applicable: readonly Assessment[],
  evidenced: readonly Assessment[],
  outstanding: readonly Assessment[],
  undetermined: readonly Assessment[],
): string {
  return `<section>
  <h2>Summary</h2>
  <p class="headline">
    ${evidenced.length} of ${applicable.length} applicable requirements have evidence recorded.
    ${outstanding.length} ${plural(outstanding.length, "is", "are")} outstanding.
    ${undetermined.length} could not be determined from the information held.
  </p>
  <p class="caution">
    This document records what evidence is on file against a versioned requirement catalog. It
    is not a declaration of conformity, not a certification, and not legal advice. Responsibility
    for what is placed on the market remains with ${""}the economic operator.
  </p>
</section>`;
}

/**
 * Undetermined requirements come FIRST, before the outstanding ones. They are the most
 * dangerous rows in the document — a reader skimming for red flags will see the outstanding
 * list and may take an empty undetermined list as reassurance, so it is never empty by
 * omission: when there are none, it says so.
 */
function undeterminedSection(rows: readonly Assessment[]): string {
  if (rows.length === 0) {
    return `<section>
  <h2>Could not be determined</h2>
  <p class="none">None. Every requirement in this catalog could be decided from the information held.</p>
</section>`;
  }
  return `<section>
  <h2>Could not be determined <span class="count">${rows.length}</span></h2>
  <p>
    The catalog could not decide whether these apply, because information about the product or
    the seller is missing. <strong>They are not excluded and they are not satisfied.</strong>
    Supplying the information below will resolve them.
  </p>
  ${rows.map(undeterminedRow).join("\n")}
</section>`;
}

function undeterminedRow(row: Assessment): string {
  return `<article class="req undetermined">
  ${requirementHeading(row)}
  <p class="needs">Needs: ${row.missing_facts.map(esc).join(", ")}</p>
  ${citation(row)}
</article>`;
}

function outstandingSection(rows: readonly Assessment[]): string {
  if (rows.length === 0) {
    return `<section><h2>Outstanding</h2><p class="none">Nothing outstanding.</p></section>`;
  }
  return `<section>
  <h2>Outstanding <span class="count">${rows.length}</span></h2>
  ${rows
    .map(
      (row) => `<article class="req outstanding">
  ${requirementHeading(row)}
  ${row.missing_data.length > 0 ? `<p class="needs">Missing data: ${row.missing_data.map((d) => esc(d.label)).join(", ")}</p>` : ""}
  ${row.missing_evidence.length > 0 ? `<p class="needs">Missing documents: ${row.missing_evidence.map((e) => esc(e.label)).join(", ")}</p>` : ""}
  ${row.expired_evidence.length > 0 ? `<p class="needs expired">Expired: ${row.expired_evidence.map(esc).join(", ")}</p>` : ""}
  ${citation(row)}
</article>`,
    )
    .join("\n")}
</section>`;
}

function evidencedSection(rows: readonly Assessment[]): string {
  if (rows.length === 0) {
    return `<section><h2>Evidenced</h2><p class="none">No requirement has evidence recorded yet.</p></section>`;
  }
  return `<section>
  <h2>Evidenced <span class="count">${rows.length}</span></h2>
  ${rows.map((row) => `<article class="req evidenced">${requirementHeading(row)}${citation(row)}</article>`).join("\n")}
</section>`;
}

/**
 * What was excluded, and on what grounds. An authority reading this should be able to see the
 * reasoning that removed a requirement, not just the requirements that survived it.
 */
function excludedSection(rows: readonly Assessment[]): string {
  if (rows.length === 0) return "";
  return `<section class="excluded-section">
  <h2>Not applicable <span class="count">${rows.length}</span></h2>
  <p>Determined not to apply to this product in this market, on the information held.</p>
  <ul>${rows.map((r) => `<li>${esc(r.title)} <span class="ref">${esc(r.regulation)}, ${esc(r.article_ref)}</span></li>`).join("")}</ul>
</section>`;
}

function requirementHeading(row: Assessment): string {
  return `<h3>${esc(row.title)}</h3>
  <p class="ref">${esc(row.regulation)} · ${esc(row.article_ref)}</p>`;
}

/** No requirement is ever rendered without its source, review date and confidence (D-008). */
function citation(row: Assessment): string {
  const links = row.citations
    .map((c) => `<a href="${esc(c.url)}">${esc(c.title)}</a>${c.retrieved_at ? ` <span class="ref">(read ${esc(c.retrieved_at)})</span>` : ""}`)
    .join("; ");
  const reviewed = row.last_reviewed_at ? `reviewed ${esc(row.last_reviewed_at)}` : "not yet reviewed";
  return `<p class="cite">Source: ${links || "none recorded"} · ${reviewed} · confidence ${esc(row.confidence)}</p>`;
}

function provenance(input: TechnicalFileInput): string {
  return `<footer>
  <h2>About this document</h2>
  <p>
    Generated ${esc(input.generatedAt)} against requirement catalog ${esc(input.assessment.catalog_version)},
    assessed as at ${esc(input.assessment.assessed_at)}. Requirements are evaluated
    deterministically from a versioned catalog; each entry cites the primary source it rests on
    and the date a human last reviewed it.
  </p>
  <p>
    Where the catalog could not determine whether a requirement applies, it is reported as
    undetermined rather than excluded. Undetermined requirements are never counted as satisfied.
  </p>
</footer>`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Every interpolated value passes through here. Product titles come from a customer's
 * spreadsheet, which is untrusted input, and this document gets shared with retailers and
 * authorities — an injected script would travel with it.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLES = `
  :root { --ink:#1a1a17; --muted:#5f5d57; --line:#d9d6cf; --bad:#8f2d20; --unknown:#6b5a8f; --ok:#1f5f4f; }
  * { box-sizing:border-box }
  body { max-width:52em; margin:0 auto; padding:32px 20px 64px; color:var(--ink);
         font:15px/1.55 ui-serif, Georgia, "Times New Roman", serif; }
  header { border-bottom:2px solid var(--ink); padding-bottom:18px; margin-bottom:26px }
  .kicker { margin:0 0 6px; font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted) }
  h1 { margin:0 0 16px; font-size:1.7rem; line-height:1.2 }
  h2 { font-size:1.05rem; margin:32px 0 10px; padding-bottom:5px; border-bottom:1px solid var(--line) }
  h3 { font-size:1rem; margin:0 0 3px }
  .meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px 20px; margin:0 }
  .meta div { margin:0 }
  .meta dt { font-size:.7rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted) }
  .meta dd { margin:2px 0 0; font-weight:600 }
  .headline { font-size:1.05rem; margin:0 0 12px }
  .caution { margin:0; padding:10px 12px; border-left:3px solid var(--muted); background:#f6f5f2;
             font-size:.875rem; color:var(--muted) }
  .count { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px;
           background:#eeece7; font-size:.75rem; font-weight:600; vertical-align:middle }
  .req { padding:12px 0 12px 14px; border-left:3px solid var(--line); margin-bottom:12px;
         break-inside:avoid }
  .req.undetermined { border-left-color:var(--unknown) }
  .req.outstanding  { border-left-color:var(--bad) }
  .req.evidenced    { border-left-color:var(--ok) }
  .ref { font-size:.8rem; color:var(--muted); margin:0 0 6px }
  .needs { margin:4px 0; font-size:.9rem }
  .needs.expired { color:var(--bad) }
  .cite { margin:6px 0 0; font-size:.78rem; color:var(--muted) }
  .cite a { color:inherit }
  .none { color:var(--muted); font-style:italic }
  .excluded-section ul { font-size:.875rem; color:var(--muted) }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line);
           font-size:.85rem; color:var(--muted) }
  @media print {
    body { max-width:none; padding:0; font-size:10.5pt }
    section, article, footer { break-inside:avoid }
    a { text-decoration:none; color:inherit }
  }
`;
