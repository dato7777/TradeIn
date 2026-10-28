import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashIpUa, type TrackedLink } from "@/lib/public/outbound";

/**
 * The only module that reads SUPABASE_SECRET_KEY.
 * It resolves an offer and writes the click log. It does not talk to the browser.
 */

const resolvedOffer = z.object({
  offer_ref: z.string().regex(/^[0-9a-f]{24}$/),
  company_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.enum(["apple", "samsung"]),
  model_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  storage_gb: z.number().int().min(1).max(16384),
  grade: z.enum(["A", "B", "C", "D"]),
  price: z.number().int().positive(),
  destination_url: z.string().min(8).max(2000),
  allowed_hosts: z.array(z.string().min(1).max(253)).min(1).max(10),
  tracking_mode: z.enum(["utm_only", "affiliate_params", "s2s"]),
  click_id_param: z.string().nullable(),
  static_params: z.record(z.string(), z.unknown()),
  utm_source_override: z.string().nullable(),
});

export type ResolvedOffer = z.infer<typeof resolvedOffer>;

export class ClickLogError extends Error {
  constructor(readonly code: "config" | "unavailable") {
    super(code);
    this.name = "ClickLogError";
  }
}

function clickClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith("sb_secret_")) throw new ClickLogError("config");
  return createClient(url, key, {
    db: { schema: "public_site" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

let client: ReturnType<typeof clickClient> | undefined;

function rpcClient() {
  try {
    client ??= clickClient();
    return client;
  } catch (error) {
    if (error instanceof ClickLogError) throw error;
    throw new ClickLogError("config");
  }
}

export async function resolveOffer(offerRef: string): Promise<ResolvedOffer | null> {
  let data: unknown;
  let error: { message?: string } | null;
  try {
    const result = await rpcClient().rpc("resolve_offer", { p_offer_ref: offerRef });
    data = result.data;
    error = result.error;
  } catch (caught) {
    if (caught instanceof ClickLogError) throw caught;
    throw new ClickLogError("unavailable");
  }
  if (error) throw new ClickLogError("unavailable");
  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new ClickLogError("unavailable");
  const parsed = resolvedOffer.safeParse(rows[0]);
  if (!parsed.success) throw new ClickLogError("unavailable");
  return parsed.data;
}

export async function recordClick(input: {
  clickId: string;
  offerRef: string;
  locale: "he" | "en";
  ip: string | null;
  ua: string;
  referrerPath: string | null;
  link: TrackedLink;
}): Promise<void> {
  const ipUaHash = hashIpUa(input.ip, input.ua, process.env.TRACKING_HASH_SECRET);
  const { error } = await rpcClient().rpc("record_click", {
    p_click_id: input.clickId,
    p_offer_ref: input.offerRef,
    p_locale: input.locale,
    p_ip_ua_hash: ipUaHash,
    p_referrer_path: input.referrerPath,
    p_url_params: input.link.params,
  });
  if (error) throw new ClickLogError("unavailable");
}

export function trackingSource(override: string | null): string {
  const token = /^[a-z0-9_-]{2,40}$/;
  if (override && token.test(override)) return override;
  const fromEnv = process.env.TRACKING_UTM_SOURCE;
  if (fromEnv && token.test(fromEnv)) return fromEnv;
  return "resparts";
}
