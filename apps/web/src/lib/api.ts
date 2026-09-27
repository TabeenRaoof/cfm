/**
 * Calls to the web Worker's /api routes (worker/routes.ts), carrying the signed-in user's Supabase
 * session so the Worker can verify who's asking and read as them under RLS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function api(client: SupabaseClient, path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

/** The error message the Worker returned, or a generic one. */
export async function apiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; reasons?: string[] };
    return [body.error, ...(body.reasons ?? [])].filter(Boolean).join(" ") || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

/** Downloads a response body as a file — used for the original documents and technical files. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
