/**
 * Node-only entry point: loading the shipped templates from disk.
 *
 * Split out for the same reason as @cfm/catalog's (decisions.md D-022) — the rendering side of
 * this package is pure and could be bundled, and one convenient `node:fs` import in the index
 * would quietly make that impossible. The failure arrives as an opaque build error, not as
 * something a reviewer would spot.
 *
 *   import { renderChannelExport } from "@cfm/channels";       // pure
 *   import { loadTemplate } from "@cfm/channels/node";
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ChannelTemplate } from "./template.ts";

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

export async function loadTemplates(): Promise<readonly ChannelTemplate[]> {
  const names = (await readdir(templatesDir)).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(
    names.map(async (n) => JSON.parse(await readFile(join(templatesDir, n), "utf8")) as ChannelTemplate),
  );
}

export async function loadTemplate(id: string): Promise<ChannelTemplate> {
  const template = (await loadTemplates()).find((t) => t.id === id);
  if (!template) throw new Error(`No channel template with id "${id}".`);
  return template;
}
