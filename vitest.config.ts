import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@cfm/catalog/node": fileURLToPath(new URL("./packages/catalog/src/node.ts", import.meta.url)),
      "@cfm/catalog": pkg("catalog"),
      "@cfm/import": pkg("import"),
      "@cfm/ai": pkg("ai"),
      "@cfm/scanner": pkg("scanner"),
      "@cfm/techfile": pkg("techfile"),
      "@cfm/channels/node": fileURLToPath(new URL("./packages/channels/src/node.ts", import.meta.url)),
      "@cfm/channels": pkg("channels"),
      "@cfm/documents": pkg("documents"),
      "@cfm/supplier-request/node": fileURLToPath(
        new URL("./packages/supplier-request/src/node.ts", import.meta.url),
      ),
      "@cfm/supplier-request": pkg("supplier-request"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});
