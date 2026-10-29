import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The only module that reads SUPABASE_SECRET_KEY.
 * Click logging and price alerts both import this client.
 */
export class PrivilegedConfigError extends Error {
  constructor() {
    super("config");
    this.name = "PrivilegedConfigError";
  }
}

export function createPrivilegedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith("sb_secret_")) throw new PrivilegedConfigError();
  return createClient(url, key, {
    db: { schema: "public_site" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

let client: ReturnType<typeof createPrivilegedClient> | undefined;

export function privilegedClient() {
  try {
    client ??= createPrivilegedClient();
    return client;
  } catch (error) {
    if (error instanceof PrivilegedConfigError) throw error;
    throw new PrivilegedConfigError();
  }
}
