/**
 * Guards on what gets deployed (D-051). The fake provider exists so the whole Cloudflare path can
 * run locally without spend; it must never be reachable from the deployable Worker.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = new URL("../", import.meta.url).pathname;

describe("the deployable Worker", () => {
  it("only the local end-to-end entry imports the fake provider", async () => {
    const files = (await readdir(join(appRoot, "worker"))).filter((f) => f.endsWith(".ts"));
    const offenders: string[] = [];
    for (const file of files) {
      if (file === "index.e2e.ts") continue;
      const code = (await readFile(join(appRoot, "worker", file), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
      if (/from\s+["'][^"']*\/fake(\.ts)?["']/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("wrangler.toml deploys the production entry, with uploads off by default", async () => {
    const config = await readFile(join(appRoot, "wrangler.toml"), "utf8");
    expect(config).toMatch(/^main = "worker\/index\.ts"$/m);
    expect(config).toMatch(/^UPLOADS_ENABLED = "false"$/m);
    expect(config).toMatch(/jurisdiction = "eu"/);
  });

  it("no secret is written into any wrangler config", async () => {
    for (const name of ["wrangler.toml", "wrangler.e2e.toml"]) {
      const config = await readFile(join(appRoot, name), "utf8");
      expect(config).not.toMatch(/^(SUPABASE_SECRET_KEY|ANTHROPIC_API_KEY)\s*=/m);
      expect(config).not.toMatch(/sk-ant-|sb_secret_/);
    }
  });
});
