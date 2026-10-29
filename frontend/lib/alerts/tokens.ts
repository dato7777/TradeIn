import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenPurpose = "confirm" | "manage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function mac(secret: string, purpose: TokenPurpose, id: string, exp: string): string {
  return createHmac("sha256", secret).update(`${purpose}|${id}|${exp}`).digest("base64url");
}

export function signToken(input: {
  purpose: TokenPurpose;
  id: string;
  exp?: number;
  secret: string;
}): string {
  if (!UUID.test(input.id)) throw new Error("id");
  const exp = input.purpose === "manage" ? "0" : String(input.exp);
  if (!/^\d+$/.test(exp)) throw new Error("exp");
  return `${input.id}.${exp}.${mac(input.secret, input.purpose, input.id, exp)}`;
}

export function verifyToken(
  token: string,
  purpose: TokenPurpose,
  secrets: { current: string; previous?: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): { id: string } | null {
  if (typeof token !== "string" || token.length > 500 || /[\r\n\s]/.test(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, given] = parts;
  if (!id || !exp || !given || !UUID.test(id) || !/^\d+$/.test(exp)) return null;
  if (purpose === "manage" && exp !== "0") return null;
  if (purpose === "confirm" && Number(exp) <= nowSeconds) return null;
  const currentOk = safeEqual(mac(secrets.current, purpose, id, exp), given);
  const previousOk = secrets.previous ? safeEqual(mac(secrets.previous, purpose, id, exp), given) : false;
  if (!currentOk && !previousOk) return null;
  return { id };
}
