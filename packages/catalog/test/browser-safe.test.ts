/**
 * The public scanner bundles the evaluator and runs it in the visitor's browser, which is the
 * whole basis of the claim that their spreadsheet never leaves their computer. A single
 * `node:fs` import anywhere in the pure surface breaks that bundle — and the failure arrives
 * as an opaque build error at deploy time, not as anything a reviewer would spot.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const src = new URL("../src/", import.meta.url).pathname;

/**
 * Modules the browser bundle never reaches: the Node entry point, and everything under `cli/`.
 * Expressed as a rule rather than a list — a hand-maintained list of exceptions is a list that
 * grows silently, and the next CLI added would either fail this test for no reason or tempt
 * someone to append to it without thinking.
 */
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
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      const code = (await readFile(join(src, file), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");

      for (const match of code.matchAll(/from\s+["']([^"']+)["']/g)) {
        expect(
          match[1],
          `${file} imports a Node built-in. Move it to node.ts — the scanner bundles this.`,
        ).not.toMatch(/^node:/);
      }
    }
  });

  it("does not re-export the node entry or any CLI from the index", async () => {
    const index = await readFile(join(src, "index.ts"), "utf8");
    expect(index).not.toMatch(/node\.ts/);
    expect(index).not.toMatch(/cli\//);
  });

  it("covers every CLI, so a new one cannot slip past the rule", async () => {
    const clis = (await tsFiles(src)).filter((f) => f.startsWith(`cli${sep}`));
    expect(clis.length).toBeGreaterThanOrEqual(3);
  });
});
