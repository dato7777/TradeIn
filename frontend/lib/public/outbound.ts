import { createHmac } from "node:crypto";

/** Keep in sync with the referrer check in read_model.record_click. */
const REFERRER_PATH = /^\/([A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*)?$/;
const CLICK_PARAM = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const UTM_TOKEN = /^[a-z0-9_-]{2,40}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content"]);

export type TrackingMode = "utm_only" | "affiliate_params" | "s2s";

export class OutboundUrlError extends Error {
  constructor() {
    super("rejected destination");
    this.name = "OutboundUrlError";
  }
}

export type TrackedLinkInput = {
  destination: string;
  allowedHosts: readonly string[];
  trackingMode: TrackingMode;
  clickIdParam: string | null;
  staticParams: Record<string, unknown>;
  utmSource: string;
  brand: "apple" | "samsung";
  modelSlug: string;
  storageGb: number;
  grade: "A" | "B" | "C" | "D";
  clickId: string;
};

export type TrackedLink = {
  href: string;
  params: Record<string, string>;
};

function fail(): never {
  throw new OutboundUrlError();
}

function normalizeHost(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return null;
  if (host.startsWith(".") || host.includes("..")) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  return host;
}

function safeParam(key: string, value: unknown, clickParam: string): string {
  if (!CLICK_PARAM.test(key) || RESERVED.has(key) || key === clickParam) fail();
  if (typeof value !== "string" || value.length < 1 || value.length > 200) fail();
  if (/[\s@\u0000-\u001f\u007f]/.test(value)) fail();
  return value;
}

/**
 * Canonical https URL on an allowlisted host, plus the attribution parameters
 * this server added. The raw destination string is never returned.
 */
export function buildTrackedUrl(input: TrackedLinkInput): TrackedLink {
  if (!UTM_TOKEN.test(input.utmSource) || !UUID_V7.test(input.clickId)) fail();
  const clickParam = input.clickIdParam ?? "click_id";
  if (!CLICK_PARAM.test(clickParam) || RESERVED.has(clickParam)) fail();

  let url: URL;
  try {
    url = new URL(input.destination);
  } catch {
    fail();
  }
  if (url.protocol !== "https:" || url.username || url.password) fail();
  if (url.port !== "") fail();
  const host = normalizeHost(url.hostname);
  if (!host) fail();
  const allowed = new Set(
    input.allowedHosts.map((entry) => normalizeHost(entry)).filter((entry): entry is string => entry !== null),
  );
  if (!allowed.has(host)) fail();

  const params: Record<string, string> = {};
  const setParam = (key: string, value: string) => {
    url.searchParams.set(key, value);
    params[key] = value;
  };

  if (input.trackingMode === "affiliate_params" || input.trackingMode === "s2s") {
    for (const [key, value] of Object.entries(input.staticParams)) {
      setParam(key, safeParam(key, value, clickParam));
    }
  }

  setParam("utm_source", input.utmSource);
  setParam("utm_medium", "comparison");
  setParam("utm_campaign", `tradein-${input.brand}`);
  setParam("utm_content", `${input.modelSlug}_${input.storageGb}_${input.grade}`);
  setParam(clickParam, input.clickId.toLowerCase());

  if (url.hostname !== host) fail();
  if (!url.href.startsWith(`https://${host}/`) && !url.href.startsWith(`https://${host}?`)) fail();
  if (url.href.length > 2000) fail();
  return { href: url.href, params };
}

export function uuidv7(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let ts = Math.floor(now);
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Daily-rotating HMAC. Returns null when there is no IP or no long enough secret. Never returns the raw IP. */
export function hashIpUa(ip: string | null, ua: string, secret: string | undefined, now = new Date()): string | null {
  if (!ip || !secret || secret.length < 32) return null;
  const day = now.toISOString().slice(0, 10);
  const salt = createHmac("sha256", secret).update(day).digest();
  return createHmac("sha256", salt)
    .update(`${ip.slice(0, 64)}\n${ua.slice(0, 256)}`)
    .digest("hex");
}

export function isNonClick(method: string, headers: { get(name: string): string | null }): boolean {
  if (method === "HEAD") return true;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return true;
  if (headers.get("next-router-prefetch") === "1") return true;
  if (headers.get("x-middleware-prefetch") === "1") return true;
  return false;
}

export function safeReferrerPath(referer: string | null, allowedOrigins: readonly string[]): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  const originOk = allowedOrigins.some((origin) => {
    try {
      return new URL(origin).origin === url.origin;
    } catch {
      return false;
    }
  });
  if (!originOk) return null;
  const path = url.pathname;
  if (path.length > 180 || path.includes("..") || !REFERRER_PATH.test(path)) return null;
  return path;
}

export function localeFromPath(path: string | null): "he" | "en" {
  if (path === "/en" || path?.startsWith("/en/")) return "en";
  return "he";
}
