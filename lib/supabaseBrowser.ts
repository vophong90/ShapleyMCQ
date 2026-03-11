// lib/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
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

  const client = createBrowserClient(url, anon);

  globalThis._supabaseBrowserClient = client;
  return client;
}
