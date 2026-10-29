import { createHmac } from "node:crypto";
import { domainToASCII } from "node:url";

/** Trim, lowercase, keep plus-tags and dots, punycode the domain. Reject anything unsafe. */
export function normalizeEmail(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) return null;
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at !== trimmed.indexOf("@") || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!/^[\x21-\x7e]+$/.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  let asciiDomain = "";
  try {
    asciiDomain = domainToASCII(domain);
  } catch {
    return null;
  }
  if (!asciiDomain || asciiDomain.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(asciiDomain)) return null;
  if (asciiDomain.startsWith(".") || asciiDomain.endsWith(".") || asciiDomain.includes("..")) return null;
  if (!asciiDomain.includes(".")) return null;
  const email = `${local}@${asciiDomain}`;
  if (email.length > 254) return null;
  return email;
}

export function hashEmail(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email).digest("hex");
}

export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`ip|${ip}`).digest("hex");
}
