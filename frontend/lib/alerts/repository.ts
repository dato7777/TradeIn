import "server-only";
import { z } from "zod";
import { PrivilegedConfigError, privilegedClient } from "@/lib/server/privileged";
import type { AlertRepository, DueSubscription, Grade, Locale, RequestOutcome, SubscriptionView } from "@/lib/alerts/types";

export class AlertDataError extends Error {
  constructor() {
    super("unavailable");
    this.name = "AlertDataError";
  }
}

const outcome = z.enum(["created", "pending_refreshed", "cooldown", "already_active", "suppressed", "cap_reached"]);
const requestRow = z.object({ id: z.string().uuid().nullable(), outcome });
const viewRow = z.object({
  id: z.string().uuid(),
  model_slug: z.string(),
  storage_gb: z.number().int(),
  condition: z.enum(["A", "B", "C", "D"]),
  locale: z.enum(["he", "en"]),
  status: z.enum(["pending", "active", "paused"]),
  pending_expires_at: z.string().nullable(),
});
const dueRow = z.object({
  id: z.string().uuid(),
  email: z.string(),
  email_hash: z.string().regex(/^[0-9a-f]{64}$/),
  model_slug: z.string(),
  storage_gb: z.number().int(),
  condition: z.enum(["A", "B", "C", "D"]),
  locale: z.enum(["he", "en"]),
  baseline_price: z.number().int().positive().nullable(),
  last_alert_at: z.string().nullable(),
  failure_count: z.number().int().nonnegative(),
});
const confirmResult = z.enum(["missing", "already_active", "expired", "confirmed"]);
const cleanupRow = z.object({
  pending_deleted: z.number().int(),
  expired_deleted: z.number().int(),
  sends_deleted: z.number().int(),
});

function rows(data: unknown): unknown[] {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const result = await privilegedClient().rpc(fn, args);
    if (result.error) throw new AlertDataError();
    return result.data;
  } catch (error) {
    if (error instanceof PrivilegedConfigError || error instanceof AlertDataError) throw new AlertDataError();
    throw new AlertDataError();
  }
}

function view(row: z.infer<typeof viewRow>): SubscriptionView {
  return {
    id: row.id,
    modelSlug: row.model_slug,
    storageGb: row.storage_gb,
    condition: row.condition,
    locale: row.locale,
    status: row.status,
    pendingExpiresAt: row.pending_expires_at,
  };
}

function due(row: z.infer<typeof dueRow>): DueSubscription {
  return {
    id: row.id,
    email: row.email,
    emailHash: row.email_hash,
    modelSlug: row.model_slug,
    storageGb: row.storage_gb,
    condition: row.condition as Grade,
    locale: row.locale as Locale,
    baselinePrice: row.baseline_price,
    lastAlertAt: row.last_alert_at,
    failureCount: row.failure_count,
  };
}

export function alertRepository(): AlertRepository {
  return {
    async request(input) {
      const data = await call("request_price_alert", {
        p_email: input.email,
        p_email_hash: input.emailHash,
        p_model_slug: input.modelSlug,
        p_storage_gb: input.storageGb,
        p_condition: input.condition,
        p_locale: input.locale,
        p_consent_text_version: input.consentVersion,
        p_signup_ip_hash: input.signupIpHash,
        p_max_per_email: input.maxPerEmail,
        p_confirm_ttl_hours: input.confirmTtlHours,
      });
      const parsed = requestRow.safeParse(rows(data)[0]);
      if (!parsed.success) throw new AlertDataError();
      return { id: parsed.data.id, outcome: parsed.data.outcome as RequestOutcome };
    },
    async get(id) {
      const data = await call("get_price_alert", { p_id: id });
      const first = rows(data)[0];
      if (!first) return null;
      const parsed = viewRow.safeParse(first);
      if (!parsed.success) throw new AlertDataError();
      return view(parsed.data);
    },
    async confirm(id, baseline, retentionDays) {
      const data = await call("confirm_price_alert", {
        p_id: id,
        p_baseline_price: baseline,
        p_retention_days: retentionDays,
      });
      const parsed = confirmResult.safeParse(data);
      if (!parsed.success) throw new AlertDataError();
      return parsed.data;
    },
    async deleteOne(id) {
      const data = await call("delete_price_alert", { p_id: id });
      if (typeof data !== "number") throw new AlertDataError();
      return data;
    },
    async deleteAll(id) {
      const data = await call("delete_price_alerts_for_same_email", { p_id: id });
      if (typeof data !== "number") throw new AlertDataError();
      return data;
    },
    async listDue(limit) {
      const data = await call("list_due_price_alerts", { p_limit: limit });
      return rows(data).map((row) => {
        const parsed = dueRow.safeParse(row);
        if (!parsed.success) throw new AlertDataError();
        return due(parsed.data);
      });
    },
    async markEvaluated(ids) {
      await call("mark_price_alerts_evaluated", { p_ids: ids });
    },
    async claim(id, claimId, cooldownHours) {
      const data = await call("claim_price_alert", { p_id: id, p_claim_id: claimId, p_cooldown_hours: cooldownHours });
      if (typeof data !== "boolean") throw new AlertDataError();
      return data;
    },
    async finish(input) {
      await call("finish_price_alert", {
        p_id: input.id,
        p_claim_id: input.claimId,
        p_kind: input.kind,
        p_old_price: input.oldPrice,
        p_new_price: input.newPrice,
        p_provider_message_id: input.providerMessageId,
        p_retention_days: input.retentionDays,
      });
    },
    async fail(input) {
      await call("fail_price_alert", {
        p_id: input.id,
        p_claim_id: input.claimId,
        p_max_failures: input.maxFailures,
        p_kind: input.kind,
        p_old_price: input.oldPrice,
        p_new_price: input.newPrice,
      });
    },
    async cleanup() {
      const data = await call("cleanup_price_alerts", {});
      const parsed = cleanupRow.safeParse(rows(data)[0]);
      if (!parsed.success) throw new AlertDataError();
      return {
        pendingDeleted: parsed.data.pending_deleted,
        expiredDeleted: parsed.data.expired_deleted,
        sendsDeleted: parsed.data.sends_deleted,
      };
    },
    async suppress(emailHash, reason) {
      const data = await call("suppress_price_alert_email", { p_email_hash: emailHash, p_reason: reason });
      if (typeof data !== "number") throw new AlertDataError();
      return data;
    },
  };
}
