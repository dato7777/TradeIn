import { siteOrigin } from "@/lib/public/format";

const PATHS = [
  /^\/sell\/(?:apple|samsung)\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/en\/sell\/(?:apple|samsung)\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/alerts\/(?:confirm|unsubscribe)$/,
  /^\/en\/alerts\/(?:confirm|unsubscribe)$/,
  /^\/api\/alerts\/unsubscribe$/,
];

function origin(): URL {
  const url = new URL(siteOrigin());
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const https = url.protocol === "https:";
  if (url.username || url.password) throw new Error("origin");
  if (!https && !(url.protocol === "http:" && local)) throw new Error("origin");
  if (url.pathname !== "/" && url.pathname !== "") throw new Error("origin");
  return url;
}

export function publicAlertUrl(path: string, query: Record<string, string> = {}): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    throw new Error("path");
  }
  if (!PATHS.some((pattern) => pattern.test(path))) throw new Error("path");
  const url = new URL(path, origin().origin);
  if (url.origin !== origin().origin) throw new Error("path");
  const allowed = new Set(["token", "storage", "condition", "utm_source", "utm_medium", "utm_campaign"]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || /[\r\n]/.test(value) || value.includes("@")) throw new Error("query");
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function httpsOrigin(): boolean {
  return origin().protocol === "https:";
}
