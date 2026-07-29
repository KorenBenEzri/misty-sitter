import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_SUPABASE_URL. " +
        "Add it to .env.local or your deployment environment."
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add it to .env.local or your deployment environment."
    );
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}
