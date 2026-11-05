import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

/** Cookie-free client for public, aggregate-only reads (lets those pages be cached). */
export function getPublicClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
