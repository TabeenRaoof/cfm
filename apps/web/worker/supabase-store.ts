/**
 * The ProcessingStore (worker/process.ts) on Supabase. Reads with the service role; writes only
 * through the four functions in migration 0003, which re-check the actor's role and record them as
 * the audit actor. The Worker never writes the document or extraction tables directly.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env.ts";
import type { DocumentStatus, NewExtraction, ProcessingStore, StoredDocument } from "./process.ts";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, NO_SESSION);
}

/** A client that acts as the caller — every read through it is filtered by RLS. */
export function callerClient(env: Env, jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    ...NO_SESSION,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function supabaseStore(client: SupabaseClient): ProcessingStore {
  return {
    async getDocument(id) {
      const { data, error } = await client
        .from("document")
        .select("id, organisation_id, doc_type, mime, storage_key, status")
        .eq("id", id)
        .maybeSingle();
      fail("reading document", error);
      return (data as StoredDocument | null) ?? null;
    },
    async setStatus(id, status: DocumentStatus, errorText = null) {
      const { error } = await client.rpc("set_document_status", { p_document_id: id, p_status: status, p_error: errorText });
      fail("setting document status", error);
    },
    async hasPipelineExtraction(documentId, promptVersion) {
      const { data, error } = await client
        .from("extraction")
        .select("id")
        .eq("document_id", documentId)
        .eq("source", "pipeline")
        .eq("prompt_version", promptVersion)
        .limit(1);
      fail("checking for an earlier extraction", error);
      return (data ?? []).length > 0;
    },
    async recordExtraction(row: NewExtraction, status: DocumentStatus, actor: string | null) {
      const { error } = await client.rpc("record_extraction", {
        p_actor: actor,
        p_extraction: row,
        p_status: status,
        p_error: null,
      });
      fail("recording extraction", error);
    },
  };
}
