/**
 * The privacy policy and DPA (D-053) against the code they describe. The pages are only as
 * truthful as their coverage: a new table holding customer data, or a new sub-processor, must
 * fail here until the texts say what it is.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dpa } from "../src/legal/Dpa.tsx";
import { PrivacyPolicy } from "../src/legal/PrivacyPolicy.tsx";
import { AUTH_EMAIL_SENDERS } from "../src/legal/senders.ts";
import { signInEmailStatement, subprocessors } from "../src/legal/subprocessors.ts";

const appRoot = new URL("../", import.meta.url).pathname;

/** Every table, and the privacy-policy wording that accounts for it. */
const TABLE_COVERAGE: Record<string, string> = {
  organisation: "Your organisation and products.",
  membership: "which organisations you belong to",
  product: "Your organisation and products.",
  invitation: "Invitations.",
  document: "Documents you upload",
  extraction: "the fields read from them",
  document_product: "Documents you upload",
  audit_log: "Change history.",
};

const privacy = renderToStaticMarkup(createElement(PrivacyPolicy));
const dpa = renderToStaticMarkup(createElement(Dpa));

/** Rendered HTML with tags stripped and whitespace collapsed, for matching prose. */
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("privacy policy coverage", () => {
  it("accounts for every table in the migrations", async () => {
    const dir = join(appRoot, "supabase", "migrations");
    const tables = new Set<string>();
    for (const file of await readdir(dir)) {
      const sql = await readFile(join(dir, file), "utf8");
      for (const match of sql.matchAll(/create table public\.([a-z_]+)/g)) tables.add(match[1]!);
    }
    expect([...tables].sort()).toEqual(Object.keys(TABLE_COVERAGE).sort());
    for (const phrase of Object.values(TABLE_COVERAGE)) expect(text(privacy)).toContain(phrase);
  });
});

describe("sub-processors", () => {
  it("both pages list every sub-processor", () => {
    for (const { name } of subprocessors()) {
      expect(text(privacy)).toContain(name);
      expect(text(dpa)).toContain(name);
    }
  });

  it("every allowed sign-in email sender has its own statement", () => {
    for (const sender of AUTH_EMAIL_SENDERS) {
      expect(signInEmailStatement(sender)).not.toBe(signInEmailStatement(null));
    }
  });
});

describe("while not in force", () => {
  it("both pages say they are drafts", () => {
    expect(text(privacy)).toContain("Draft — not yet in force.");
    expect(text(dpa)).toContain("Draft — not yet in force.");
  });
});
