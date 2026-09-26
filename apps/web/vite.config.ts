/**
 * The logged-in app (D-048): a React single-page app, deployed to Cloudflare Pages, talking to
 * Supabase directly for tenant data under row-level security.
 *
 * Two build gates, in the scanner's "assert, don't trust" style:
 *   - A production build refuses without the Supabase URL and publishable key, rather than
 *     shipping an app that can't sign anyone in. `build:preview` allows it (renders a
 *     "not configured" screen).
 *   - Every build fails if the bundle contains something shaped like a server secret. Anything
 *     VITE_-prefixed is shipped to every visitor; an Anthropic key or a Supabase service-role key
 *     reaching the browser would be a full compromise, and it would not announce itself.
 */

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

const SECRET_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, "an Anthropic API key"],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, "a Supabase secret key"],
  [/"role"\s*:\s*"service_role"/, "a Supabase service-role JWT payload"],
];

function refuseSecretsInBundle(): Plugin {
  return {
    name: "cfm-refuse-secrets-in-bundle",
    generateBundle(_options, bundle) {
      for (const [file, output] of Object.entries(bundle)) {
        const code = output.type === "chunk" ? output.code : String(output.source);
        for (const [pattern, label] of SECRET_PATTERNS) {
          if (pattern.test(code)) {
            this.error(`${file} contains ${label}. Server secrets must never be VITE_-prefixed or imported by browser code.`);
          }
        }
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && mode === "production") {
    const missing = REQUIRED.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Production build needs ${missing.join(" and ")} — set them in the environment (see ` +
          `.env.example). Use \`npm run build:preview\` for a build that renders "not configured".`,
      );
    }
  }
  return { plugins: [react(), refuseSecretsInBundle()] };
});
