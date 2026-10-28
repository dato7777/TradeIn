import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/env/server";
import type { Database } from "./database.types";

function createReadClient() {
  return createClient<Database, "public_site">(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      db: { schema: "public_site" },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}

let client: ReturnType<typeof createReadClient> | undefined;

// Anonymous, cookie-less client for the public read model only. No user session
// is ever attached, so responses are safe to cache and share.
export function getReadClient() {
  client ??= createReadClient();
  return client;
}
