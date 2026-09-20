/**
 * Node-only entry point. Everything here touches the filesystem, so nothing that runs in a
 * browser may import it — see the note at the top of `catalog.ts`.
 *
 *   import { assessProduct } from "@cfm/catalog";        // pure, browser-safe
 *   import { loadCatalogFromDir } from "@cfm/catalog/node";
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BuildOptions, BuildResult } from "./catalog.ts";
import { buildCatalog } from "./catalog.ts";

export async function loadCatalogFromDir(
  directory: string,
  options: BuildOptions,
): Promise<BuildResult> {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".json")).sort();
  const entries = await Promise.all(
    names.map(async (name) => ({
      file: name,
      data: JSON.parse(await readFile(join(directory, name), "utf8")) as unknown,
    })),
  );
  return buildCatalog(entries, options);
}
