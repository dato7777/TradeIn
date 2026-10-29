"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { productionDeps } from "@/lib/alerts/wiring";
import { previewAlert, runConfirm, runSubscribe, runUnsubscribe, type SubscribeResult } from "@/lib/alerts/service";
import { gradeSchema, modelSlugSchema, storageGbSchema } from "@/lib/public/schemas";
import { clientIp } from "@/lib/public/rateLimit";

const subscribeSchema = z.object({
  email: z.string().max(320),
  modelSlug: modelSlugSchema,
  storage: storageGbSchema,
  condition: gradeSchema,
  locale: z.enum(["he", "en"]),
  turnstileToken: z.string().max(2048).default(""),
  website: z.string().max(200).default(""),
});

function requestIp(): string | null {
  return clientIp(headers().get("x-forwarded-for"));
}

export async function subscribeToPriceAlert(raw: unknown): Promise<SubscribeResult> {
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error" };
  try {
    return await runSubscribe({ ...parsed.data, ip: requestIp() }, productionDeps());
  } catch {
    return { ok: false, code: "error" };
  }
}

export async function confirmPriceAlert(token: string) {
  if (typeof token !== "string" || token.length > 500) return { ok: true as const, status: "invalid" as const };
  try {
    return await runConfirm(token, requestIp(), productionDeps());
  } catch {
    return { ok: false as const, code: "error" as const };
  }
}

export async function unsubscribePriceAlert(token: string, scope: "one" | "all") {
  if (typeof token !== "string" || token.length > 500 || (scope !== "one" && scope !== "all")) {
    return { ok: true as const, status: "invalid" as const };
  }
  try {
    return await runUnsubscribe(token, scope, requestIp(), productionDeps());
  } catch {
    return { ok: false as const, code: "error" as const };
  }
}

export async function loadAlertPreview(token: string, purpose: "confirm" | "manage") {
  if (typeof token !== "string") return { ok: true as const, state: "invalid" as const };
  try {
    return await previewAlert(token, purpose, requestIp(), productionDeps());
  } catch {
    return { ok: false as const, code: "error" as const };
  }
}
