// lib/supabase-browser.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var _supabaseBrowserClient: SupabaseClient | undefined;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (globalThis._supabaseBrowserClient) {
    return globalThis._supabaseBrowserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  globalThis._supabaseBrowserClient = client;
  return client;
}
