/**
 * The web Worker (D-051): the SPA's static assets, the /api routes, and the document queue's
 * consumer — one deployable, because a Pages project can't consume a Queue and a Worker with
 * static assets can do all three.
 *
 * The AI provider is injected: worker/index.ts passes Anthropic, worker/index.e2e.ts passes a fake
 * for local end-to-end runs. Nothing else in this directory may import the fake
 * (test/worker-boundary.test.ts).
 */

import { Gateway, type Provider, type UsageRecord } from "@cfm/ai";
import type { DocumentMessage, Env } from "./env.ts";
import { unpdfReader } from "./pdf.ts";
import { processDocument } from "./process.ts";
import { handleApi } from "./routes.ts";
import { serviceClient, supabaseStore } from "./supabase-store.ts";

/** Attempts before the document is marked failed rather than retried (≤ max_retries + 1). */
export const MAX_ATTEMPTS = 3;

export function createWorker(providerFor: (env: Env) => Provider): ExportedHandler<Env, DocumentMessage> {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        try {
          return await handleApi(request, env);
        } catch (error) {
          console.error("api error", error);
          return new Response(JSON.stringify({ error: "Something went wrong." }), { status: 500 });
        }
      }
      return env.ASSETS.fetch(request);
    },

    async queue(batch, env) {
      const store = supabaseStore(serviceClient(env));
      for (const message of batch.messages) {
        const { documentId } = message.body;
        const entries: UsageRecord[] = [];
        const gateway = new Gateway({
          provider: providerFor(env),
          models: { extract: env.EXTRACT_MODEL ?? "claude-sonnet-5", classify: "claude-haiku-4-5" },
          usage: { record: (entry) => entries.push(entry) },
        });
        try {
          await processDocument(
            {
              store,
              storage: { get: async (key) => { const o = await env.DOCS.get(key); return o ? new Uint8Array(await o.arrayBuffer()) : null; } },
              gateway,
              lastUsage: () => entries.at(-1) ?? null,
              pdf: unpdfReader,
              today: () => new Date().toISOString().slice(0, 10),
            },
            documentId,
          );
          message.ack();
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          if (message.attempts >= MAX_ATTEMPTS) {
            await store.setStatus(documentId, "failed", `Automatic reading failed after ${message.attempts} attempts: ${reason}`);
            message.ack();
          } else {
            message.retry({ delaySeconds: 30 * message.attempts });
          }
        }
      }
    },
  };
}
