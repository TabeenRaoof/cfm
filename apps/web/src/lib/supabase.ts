import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * The browser's Supabase client. It holds only the publishable key, which grants nothing beyond
 * what row-level security allows the signed-in user (supabase/migrations/, test/rls.test.ts).
 * `null` in a build without Supabase settings — the app renders a "not configured" screen rather
 * than failing on the first request.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
