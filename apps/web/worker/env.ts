/** Bindings and settings for the web Worker (wrangler.toml, D-051). */

export interface DocumentMessage {
  readonly documentId: string;
}

export interface Env {
  /** The built SPA (apps/web/dist), served for everything that isn't /api/*. */
  readonly ASSETS: Fetcher;
  /** Uploaded originals, in an EU-jurisdiction R2 bucket. Immutable once written. */
  readonly DOCS: R2Bucket;
  /** Upload → processing. The same Worker consumes it (queue handler). */
  readonly DOC_QUEUE: Queue<DocumentMessage>;
  readonly SUPABASE_URL: string;
  /** Public by design; used to verify a caller's session and to read as that caller under RLS. */
  readonly SUPABASE_PUBLISHABLE_KEY: string;
  /** Secret (`wrangler secret put`). Only ever used to call the four write functions in migration 0003. */
  readonly SUPABASE_SECRET_KEY: string;
  /** Secret. Absent in local end-to-end runs, which use a fake provider (worker/index.e2e.ts). */
  readonly ANTHROPIC_API_KEY?: string;
  /**
   * "true" only once D-013's paperwork is in place — customer DPA, design-partner agreement,
   * deletion procedure, vendor DPAs. Anything else and uploads are refused, so the first real
   * document can't arrive by accident before the obligations that attach to it are met.
   */
  readonly UPLOADS_ENABLED?: string;
  /** The model behind the "extract" role — configuration, never code (D-014). */
  readonly EXTRACT_MODEL?: string;
}
