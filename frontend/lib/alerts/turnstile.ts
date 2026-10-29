import { z } from "zod";

const payload = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

export function turnstileOk(
  body: unknown,
  expected: { hostnames: string[]; action: string },
): boolean {
  const parsed = payload.safeParse(body);
  if (!parsed.success || !parsed.data.success) return false;
  if (parsed.data.action !== expected.action) return false;
  if (!parsed.data.hostname || !expected.hostnames.includes(parsed.data.hostname)) return false;
  return true;
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  expected: { hostnames: string[]; action: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 2048 || !secret) return false;
  let response: Response;
  try {
    response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  try {
    return turnstileOk(await response.json(), expected);
  } catch {
    return false;
  }
}
