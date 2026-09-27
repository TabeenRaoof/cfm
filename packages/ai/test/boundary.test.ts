/**
 * The seam, enforced.
 *
 * decisions.md D-014 and tabeen_AGENTS.md both say that provider SDKs are imported in
 * @cfm/ai and nowhere else. This is that rule as a test, because the rule's whole value is
 * that it holds on the day someone is in a hurry — and on that day nobody re-reads AGENTS.md.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../../", import.meta.url).pathname;

/** Module specifiers that mean "a specific vendor's client is being used here". */
const PROVIDER_SDKS = [
  "@anthropic-ai/sdk",
  "@anthropic-ai/bedrock-sdk",
  "@anthropic-ai/vertex-sdk",
  "openai",
  "@google/generative-ai",
  "@google/genai",
  "@mistralai/mistralai",
  "cohere-ai",
  "@ai-sdk/anthropic",
  "@ai-sdk/openai",
  "@ai-sdk/google",
  "ollama",
];

/** The only directory permitted to name a vendor. Does not exist yet; that is the point. */
const ADAPTER_DIR = join("packages", "ai", "src", "providers");

async function sourceFiles(dir: string, found: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await sourceFiles(full, found);
    else if (entry.name.endsWith(".ts")) found.push(full);
  }
  return found;
}

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

describe("provider isolation", () => {
  it("no file outside the adapter directory imports a provider SDK", async () => {
    // apps/ too: the web Worker reaches the model, and must do it through @cfm/ai like everything else.
    const files = [...(await sourceFiles(join(repoRoot, "packages"))), ...(await sourceFiles(join(repoRoot, "apps")))];
    expect(files.length).toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const file of files) {
      const relative = file.slice(repoRoot.length);
      if (relative.startsWith(ADAPTER_DIR)) continue;

      const text = await readFile(file, "utf8");
      // Only look at the code, not at the prose explaining why the rule exists.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

      for (const match of code.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] as string;
        if (PROVIDER_SDKS.some((sdk) => specifier === sdk || specifier.startsWith(`${sdk}/`))) {
          offenders.push(`${relative} imports ${specifier}`);
        }
      }
    }

    expect(
      offenders,
      `A provider SDK may only be imported from ${ADAPTER_DIR}. Everything else goes through ` +
        `the Provider interface, or a swap stops being a configuration change.`,
    ).toEqual([]);
  });

  it("the deterministic packages do not depend on @cfm/ai at all", async () => {
    // The catalog, the importer and the scanner must remain runnable with no AI configured —
    // the scanner in particular is public and must never be able to spend money (D-009).
    for (const pkg of ["catalog", "import", "scanner", "techfile", "channels"]) {
      const files = await sourceFiles(join(repoRoot, "packages", pkg));
      for (const file of files) {
        const text = await readFile(file, "utf8");
        const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
        for (const match of code.matchAll(IMPORT_PATTERN)) {
          expect(match[1], `${file.slice(repoRoot.length)} must not import @cfm/ai`).not.toBe("@cfm/ai");
        }
      }
    }
  });
});
