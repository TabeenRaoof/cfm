/**
 * Everything except token generation is pure — a supplier-upload page or an email preview could
 * run this in a browser. Same rule, same reason, as @cfm/catalog and @cfm/channels (D-022).
 */

import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const src = new URL("../src/", import.meta.url).pathname;
const NODE_ONLY = (file: string) => file === "node.ts" || file.startsWith(`cli${sep}`);

async function tsFiles(dir: string, base = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = join(base, entry.name);
    if (entry.isDirectory()) out.push(...(await tsFiles(join(dir, entry.name), rel)));
    else if (entry.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}

describe("the browser-safe surface", () => {
  it("imports no Node built-in", async () => {
    const files = (await tsFiles(src)).filter((f) => !NODE_ONLY(f));
    expect(files.length).toBeGreaterThan(2);

    for (const file of files) {
      const code = (await readFile(join(src, file), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");
      for (const match of code.matchAll(/from\s+["']([^"']+)["']/g)) {
        expect(match[1], `${file} imports a Node built-in — move it to node.ts`).not.toMatch(/^node:/);
      }
    }
  });

  it("does not re-export the node entry from the index", async () => {
    expect(await readFile(join(src, "index.ts"), "utf8")).not.toMatch(/node\.ts/);
  });
});
