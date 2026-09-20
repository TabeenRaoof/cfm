/**
 * Minimal static server for looking at the built scanner locally. Not for production — any
 * static host serves `dist/` directly.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT ?? 4321);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  const requested = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = normalize(requested === "/" ? "index.html" : requested.slice(1));

  // Path traversal is not a real risk on a dev server, but a dev server that would serve
  // ../../.env is a bad habit to leave lying in a repository.
  if (relative.startsWith("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(join(dist, relative));
    response.writeHead(200, { "content-type": TYPES[extname(relative)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found. Run `npm run scanner:preview` first.");
  }
}).listen(port, () => console.log(`scanner preview → http://localhost:${port}`));
