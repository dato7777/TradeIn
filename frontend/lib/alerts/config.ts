import { z } from "zod";

export class AlertConfigError extends Error {
  constructor() {
    super("config");
    this.name = "AlertConfigError";
  }
}

const secret = z.string().min(32).max(200).refine((value) => !/[\r\n\0]/.test(value));

const schema = z.object({
  hashSecret: secret,
  tokenSecret: secret,
  tokenSecretPrevious: secret.optional(),
  emailFrom: z.string().min(6).max(200).refine((value) => !/[\r\n\0]/.test(value)),
  replyTo: z.string().email().max(254).refine((value) => !/[\r\n\0]/.test(value)),
  cronSecret: z.string().min(16).max(200).refine((value) => !/[\r\n\0]/.test(value)),
  webhookSecret: z.string().min(8).max(200).optional(),
  resendApiKey: z.string().min(8).max(200).optional(),
  minChangeIls: z.number().int().min(1).max(100_000),
  minChangePercent: z.number().positive().max(100),
  cooldownHours: z.number().int().min(1).max(168),
  batchSize: z.number().int().min(1).max(500),
  maxPerEmail: z.number().int().min(1).max(20),
  maxFailures: z.number().int().min(1).max(20),
  confirmTtlHours: z.number().int().min(1).max(168),
  retentionDays: z.number().int().min(1).max(3650),
  maxConfirmationsPerDay: z.number().int().min(1).max(1_000_000),
  adLabel: z.boolean(),
  allowRealSendNonProd: z.boolean(),
  provider: z.enum(["resend", "console", "memory"]),
  turnstileSecret: z.string().min(8).max(200).optional(),
  turnstileHostnames: z.array(z.string().min(1).max(253)).min(1),
});

export type AlertConfig = z.infer<typeof schema>;

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : Number.NaN;
}

function flag(name: string, fallback: boolean): boolean | string {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function provider(): "resend" | "console" | "memory" | string {
  const set = process.env.EMAIL_PROVIDER?.trim() ?? "";
  const chosen = set === "" ? (process.env.NODE_ENV === "production" ? "resend" : "console") : set;
  if (chosen === "resend" && process.env.NODE_ENV !== "production" && process.env.EMAIL_ALLOW_REAL_SEND_NON_PROD !== "true") {
    return "console";
  }
  if (chosen === "memory" && process.env.NODE_ENV === "production") return "memory-in-production";
  return chosen;
}

function hostnames(): string[] {
  const fromSite = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://resparts.vercel.app").hostname;
    } catch {
      return "";
    }
  })();
  const extra = (process.env.TURNSTILE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const local = process.env.NODE_ENV === "production" ? [] : ["localhost", "127.0.0.1"];
  return Array.from(new Set([fromSite, ...extra, ...local].filter(Boolean)));
}

let cached: AlertConfig | undefined;

/** Parsed on first alert use so the catalog stays up before the checklist is filled in. */
export function alertConfig(): AlertConfig {
  if (cached) return cached;
  const parsed = schema.safeParse({
    hashSecret: process.env.ALERT_HASH_SECRET,
    tokenSecret: process.env.ALERT_TOKEN_SECRET,
    tokenSecretPrevious: process.env.ALERT_TOKEN_SECRET_PREVIOUS || undefined,
    emailFrom: process.env.EMAIL_FROM,
    replyTo: process.env.EMAIL_REPLY_TO,
    cronSecret: process.env.CRON_SECRET,
    webhookSecret: process.env.EMAIL_WEBHOOK_SECRET || undefined,
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    minChangeIls: integer("ALERT_MIN_CHANGE_ILS", 30),
    minChangePercent: Number(process.env.ALERT_MIN_CHANGE_PERCENT || 3),
    cooldownHours: integer("ALERT_COOLDOWN_HOURS", 24),
    batchSize: integer("ALERT_BATCH_SIZE", 200),
    maxPerEmail: integer("ALERT_MAX_PER_EMAIL", 5),
    maxFailures: integer("ALERT_MAX_FAILURES", 5),
    confirmTtlHours: integer("ALERT_CONFIRM_TTL_HOURS", 48),
    retentionDays: integer("ALERT_RETENTION_DAYS", 365),
    maxConfirmationsPerDay: integer("ALERT_MAX_CONFIRMATIONS_PER_DAY", 2000),
    adLabel: flag("ALERT_AD_LABEL_ENABLED", false),
    allowRealSendNonProd: flag("EMAIL_ALLOW_REAL_SEND_NON_PROD", false),
    provider: provider(),
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY || undefined,
    turnstileHostnames: hostnames(),
  });
  if (!parsed.success) throw new AlertConfigError();
  cached = parsed.data;
  return cached;
}

export function resetAlertConfigForTests(): void {
  cached = undefined;
}
