import { createClient } from "@supabase/supabase-js";

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
