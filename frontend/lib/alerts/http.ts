import { Webhook } from "svix";
import { z } from "zod";
import { hashEmail, normalizeEmail } from "@/lib/alerts/email";
import { runCleanup, runEvaluation, runUnsubscribe, type AlertDeps } from "@/lib/alerts/service";
import { safeEqual } from "@/lib/alerts/tokens";
import { clientIp } from "@/lib/public/rateLimit";

function bearerOk(header: string | null, secret: string): boolean {
  const value = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!value || !secret) return false;
  return safeEqual(value, secret);
}

export async function handleCron(request: Request, deps: AlertDeps): Promise<Response> {
  if (!bearerOk(request.headers.get("authorization"), deps.config.cronSecret)) {
    return new Response(null, { status: 401 });
  }
  const task = new URL(request.url).searchParams.get("task");
  try {
    if (task === "evaluate") {
      const counts = await runEvaluation(deps, { maxDurationMs: 10_000 });
      return Response.json(counts);
    }
    if (task === "cleanup") {
      const counts = await runCleanup(deps);
      return Response.json(counts);
    }
  } catch {
    return Response.json({ checked: 0, sent: 0, skipped: 0, failed: 0 }, { status: 500 });
  }
  return new Response(null, { status: 400 });
}

const bounce = z.object({
  type: z.string(),
  data: z
    .object({
      to: z.array(z.string()).default([]),
      bounce: z.object({ type: z.string() }).optional(),
    })
    .passthrough(),
});

export async function handleEmailWebhook(request: Request, deps: AlertDeps): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (!deps.config.webhookSecret) return new Response(null, { status: 401 });
  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return new Response(null, { status: 401 });
  try {
    new Webhook(deps.config.webhookSecret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });
  } catch {
    return new Response(null, { status: 401 });
  }
  let verified: unknown;
  try {
    verified = JSON.parse(payload);
  } catch {
    return new Response(null, { status: 200 });
  }
  const parsed = bounce.safeParse(verified);
  if (!parsed.success) return new Response(null, { status: 200 });
  const hard =
    parsed.data.type === "email.bounced" && /^(permanent|hard)$/i.test(parsed.data.data.bounce?.type ?? "");
  const complaint = parsed.data.type === "email.complained";
  if (!hard && !complaint) return new Response(null, { status: 200 });
  const reason = complaint ? "complaint" : "bounce";
  for (const address of parsed.data.data.to) {
    const email = normalizeEmail(address);
    if (!email) continue;
    await deps.repo.suppress(hashEmail(email, deps.config.hashSecret), reason);
  }
  return new Response(null, { status: 200 });
}

export async function handleOneClick(request: Request, deps: AlertDeps): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const body = await request.text();
  const params = new URLSearchParams(body);
  if (body !== "List-Unsubscribe=One-Click" && params.get("List-Unsubscribe") !== "One-Click") {
    return new Response(null, { status: 400 });
  }
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  const result = await runUnsubscribe(token, "one", ip, deps);
  if (!result.ok && result.code === "rate_limited") {
    return new Response(null, { status: 429, headers: { "retry-after": "60" } });
  }
  if (!result.ok) return new Response(null, { status: 200 });
  return new Response(null, { status: 200 });
}
