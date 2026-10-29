import { randomUUID } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import type { AlertConfig } from "@/lib/alerts/config";
import { hashEmail, hashIp, normalizeEmail } from "@/lib/alerts/email";
import { evaluateAlert } from "@/lib/alerts/evaluate";
import { httpsOrigin, publicAlertUrl } from "@/lib/alerts/links";
import { fromHeader, providerMessageId } from "@/lib/alerts/provider";
import { renderAlert, renderConfirmation } from "@/lib/alerts/templates";
import { signToken, verifyToken } from "@/lib/alerts/tokens";
import type { AlertLimiter } from "@/lib/alerts/rateLimit";
import type { AlertRepository, EmailProvider, Grade, Locale, PriceQuote } from "@/lib/alerts/types";
import { CONSENT_TEXT_VERSION } from "@/lib/alertsCopy";
import { formatIls } from "@/lib/public/format";
import { modelPath } from "@/lib/public/paths";
import { publicCopy } from "@/lib/publicCopy";
import { verifyTurnstile } from "@/lib/alerts/turnstile";

export type SubscribeResult = { ok: true } | { ok: false; code: "invalid_email" | "rate_limited" | "error" };

export type SubscribeInput = {
  email: string;
  modelSlug: string;
  storage: number;
  condition: Grade;
  locale: Locale;
  turnstileToken: string;
  website: string;
  ip: string | null;
};

export type AlertDeps = {
  config: AlertConfig;
  repo: AlertRepository;
  limiter: AlertLimiter;
  mailer: EmailProvider;
  phoneExists(modelSlug: string, storageGb: number, grade: Grade): Promise<boolean>;
  quote(modelSlug: string, storageGb: number, grade: Grade, locale: Locale): Promise<PriceQuote | null>;
  verifyTurnstile?(token: string): Promise<boolean>;
  schedule?: (task: () => Promise<void>) => void;
  now?: () => Date;
};

function scheduleDefault(task: () => Promise<void>): void {
  const work = task().catch(() => {
    console.error("price-alert follow-up failed");
  });
  try {
    waitUntil(work);
  } catch {
    // Local runs have no Vercel request context. The promise is already started.
  }
}

function ipHash(ip: string | null, secret: string): string {
  return hashIp(ip ?? "missing", secret);
}

export async function runSubscribe(input: SubscribeInput, deps: AlertDeps): Promise<SubscribeResult> {
  if (input.website.trim() !== "") return { ok: true };
  const ipKey = ipHash(input.ip, deps.config.hashSecret);
  const email = normalizeEmail(input.email);
  if (!email) {
    const limited = await deps.limiter.ip(ipKey);
    if (!limited.ok) return { ok: false, code: "rate_limited" };
    return { ok: false, code: "invalid_email" };
  }
  const emailHash = hashEmail(email, deps.config.hashSecret);
  const limited = await deps.limiter.subscribe(ipKey, emailHash);
  if (!limited.ok) {
    if (limited.reason === "global") console.error("price-alert monitoring confirmation_cap");
    return { ok: false, code: "rate_limited" };
  }
  try {
    const turnstile = deps.verifyTurnstile
      ? await deps.verifyTurnstile(input.turnstileToken)
      : await verifyTurnstile(input.turnstileToken, deps.config.turnstileSecret ?? "", {
          hostnames: deps.config.turnstileHostnames,
          action: "price-alert",
        });
    if (!turnstile) return { ok: false, code: "error" };
    if (!(await deps.phoneExists(input.modelSlug, input.storage, input.condition))) return { ok: false, code: "error" };
    const requested = await deps.repo.request({
      email,
      emailHash,
      modelSlug: input.modelSlug,
      storageGb: input.storage,
      condition: input.condition,
      locale: input.locale,
      consentVersion: CONSENT_TEXT_VERSION,
      signupIpHash: input.ip ? hashIp(input.ip, deps.config.hashSecret) : null,
      maxPerEmail: deps.config.maxPerEmail,
      confirmTtlHours: deps.config.confirmTtlHours,
    });
    if ((requested.outcome === "created" || requested.outcome === "pending_refreshed") && requested.id) {
      const id = requested.id;
      (deps.schedule ?? scheduleDefault)(() => sendConfirmation(deps, id, email, emailHash, input));
    }
    return { ok: true };
  } catch {
    return { ok: false, code: "error" };
  }
}

async function sendConfirmation(deps: AlertDeps, id: string, email: string, emailHash: string, input: SubscribeInput) {
  const quote = await deps.quote(input.modelSlug, input.storage, input.condition, input.locale);
  if (!quote) return;
  const exp = Math.floor(Date.now() / 1000) + deps.config.confirmTtlHours * 60 * 60;
  const confirmToken = signToken({ purpose: "confirm", id, exp, secret: deps.config.tokenSecret });
  const manageToken = signToken({ purpose: "manage", id, secret: deps.config.tokenSecret });
  const prefix = input.locale === "en" ? "/en" : "";
  const phone = `${quote.modelName} · ${input.storage} GB · ${input.condition}`;
  const rendered = await renderConfirmation({
    locale: input.locale,
    siteName: publicCopy[input.locale].siteName,
    phone,
    priceLabel: quote.current == null ? null : formatIls(quote.current, input.locale),
    confirmUrl: publicAlertUrl(`${prefix}/alerts/confirm`, { token: confirmToken }),
    unsubscribeUrl: publicAlertUrl(`${prefix}/alerts/unsubscribe`, { token: manageToken }),
    replyTo: deps.config.replyTo,
    hours: deps.config.confirmTtlHours,
    adLabel: deps.config.adLabel,
  });
  await deps.mailer.send({
    to: email,
    from: fromHeader(publicCopy[input.locale].siteName, deps.config.emailFrom),
    replyTo: deps.config.replyTo,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: `confirm-${id}-${exp}`,
  });
  console.info("price-alert confirmation queued", emailHash.slice(0, 8));
}

export async function runConfirm(token: string, ip: string | null, deps: AlertDeps) {
  const limited = await deps.limiter.tokenRoute(ipHash(ip, deps.config.hashSecret));
  if (!limited.ok) return { ok: false as const, code: "rate_limited" as const };
  const verified = verifyToken(token, "confirm", {
    current: deps.config.tokenSecret,
    previous: deps.config.tokenSecretPrevious,
  });
  if (!verified) return { ok: true as const, status: "invalid" as const };
  try {
    const row = await deps.repo.get(verified.id);
    if (!row) return { ok: true as const, status: "invalid" as const };
    const quote = await deps.quote(row.modelSlug, row.storageGb, row.condition, row.locale);
    const result = await deps.repo.confirm(verified.id, quote?.current ?? null, deps.config.retentionDays);
    if (result === "confirmed") return { ok: true as const, status: "confirmed" as const };
    if (result === "already_active") return { ok: true as const, status: "already" as const };
    return { ok: true as const, status: "invalid" as const };
  } catch {
    return { ok: false as const, code: "error" as const };
  }
}

export async function runUnsubscribe(token: string, scope: "one" | "all", ip: string | null, deps: AlertDeps) {
  const limited = await deps.limiter.tokenRoute(ipHash(ip, deps.config.hashSecret));
  if (!limited.ok) return { ok: false as const, code: "rate_limited" as const };
  const verified = verifyToken(token, "manage", {
    current: deps.config.tokenSecret,
    previous: deps.config.tokenSecretPrevious,
  });
  if (!verified) return { ok: true as const, status: "invalid" as const };
  try {
    const count = scope === "all" ? await deps.repo.deleteAll(verified.id) : await deps.repo.deleteOne(verified.id);
    if (count < 0) return { ok: true as const, status: "invalid" as const };
    return { ok: true as const, status: scope === "all" ? ("all" as const) : ("one" as const) };
  } catch {
    return { ok: false as const, code: "error" as const };
  }
}

export async function runEvaluation(
  deps: AlertDeps,
  options: { maxDurationMs: number; startedAt?: number } = { maxDurationMs: 8_000 },
): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
  const started = options.startedAt ?? Date.now();
  const budget = options.maxDurationMs * 0.8;
  const now = deps.now ?? (() => new Date());
  const due = await deps.repo.listDue(deps.config.batchSize);
  await deps.repo.markEvaluated(due.map((row) => row.id));
  const quotes = new Map<string, PriceQuote | null>();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of due) {
    if (Date.now() - started > budget) break;
    const key = `${row.modelSlug}|${row.storageGb}|${row.condition}|${row.locale}`;
    if (!quotes.has(key)) {
      quotes.set(key, await deps.quote(row.modelSlug, row.storageGb, row.condition, row.locale).catch(() => null));
    }
    const quote = quotes.get(key) ?? null;
    if (!quote) {
      skipped += 1;
      continue;
    }
    const decision = evaluateAlert({
      baseline: row.baselinePrice,
      current: quote.current,
      lastAlertAt: row.lastAlertAt ? new Date(row.lastAlertAt) : null,
      now: now(),
      cfg: {
        minChangeIls: deps.config.minChangeIls,
        minChangePercent: deps.config.minChangePercent,
        cooldownHours: deps.config.cooldownHours,
      },
    });
    if (!decision.send) {
      skipped += 1;
      continue;
    }
    const claimId = randomUUID();
    const claimed = await deps.repo.claim(row.id, claimId, deps.config.cooldownHours);
    if (!claimed) {
      skipped += 1;
      continue;
    }
    try {
      const manage = signToken({ purpose: "manage", id: row.id, secret: deps.config.tokenSecret });
      const prefix = row.locale === "en" ? "/en" : "";
      const offerUrl = publicAlertUrl(modelPath(row.locale, quote.brand, row.modelSlug), {
        storage: String(row.storageGb),
        condition: row.condition,
        utm_source: "price-alert",
        utm_medium: "email",
        utm_campaign: "alert",
      });
      const rendered = await renderAlert({
        locale: row.locale,
        siteName: publicCopy[row.locale].siteName,
        kind: decision.kind,
        phone: `${quote.modelName} · ${row.storageGb} GB · ${row.condition}`,
        model: quote.modelName,
        oldPrice: decision.baseline,
        newPrice: decision.current,
        percent: decision.deltaPercent,
        offers: quote.top,
        offerUrl,
        unsubscribeUrl: publicAlertUrl(`${prefix}/alerts/unsubscribe`, { token: manage }),
        replyTo: deps.config.replyTo,
        adLabel: deps.config.adLabel,
      });
      const headers: Record<string, string> = {};
      if (httpsOrigin()) {
        const oneClick = publicAlertUrl("/api/alerts/unsubscribe", { token: manage });
        headers["List-Unsubscribe"] = `<${oneClick}>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }
      const sentMail = await deps.mailer.send({
        to: row.email,
        from: fromHeader(publicCopy[row.locale].siteName, deps.config.emailFrom),
        replyTo: deps.config.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers,
        idempotencyKey: claimId,
      });
      await deps.repo.finish({
        id: row.id,
        claimId,
        kind: decision.kind,
        oldPrice: decision.baseline,
        newPrice: decision.current,
        providerMessageId: providerMessageId(sentMail.id),
        retentionDays: deps.config.retentionDays,
      });
      console.info("price-alert sent", row.emailHash.slice(0, 8));
      sent += 1;
    } catch {
      failed += 1;
      await deps.repo.fail({
        id: row.id,
        claimId,
        maxFailures: deps.config.maxFailures,
        kind: decision.kind,
        oldPrice: decision.baseline,
        newPrice: decision.current,
      }).catch(() => undefined);
    }
  }
  return { checked: due.length, sent, skipped, failed };
}

export async function runCleanup(deps: AlertDeps) {
  return deps.repo.cleanup();
}

export async function previewAlert(
  token: string,
  purpose: "confirm" | "manage",
  ip: string | null,
  deps: AlertDeps,
): Promise<
  | { ok: false; code: "rate_limited" | "error" }
  | { ok: true; state: "invalid" }
  | { ok: true; state: "done" }
  | { ok: true; state: "already" | "ready"; modelName: string; storageGb: number; condition: string; locale: Locale }
> {
  const limited = await deps.limiter.tokenRoute(ipHash(ip, deps.config.hashSecret));
  if (!limited.ok) return { ok: false, code: "rate_limited" };
  const verified = verifyToken(token, purpose, {
    current: deps.config.tokenSecret,
    previous: deps.config.tokenSecretPrevious,
  });
  if (!verified) return { ok: true, state: "invalid" };
  try {
    const row = await deps.repo.get(verified.id);
    if (!row) return purpose === "manage" ? { ok: true, state: "done" } : { ok: true, state: "invalid" };
    if (purpose === "confirm" && row.status === "active") {
      const quote = await deps.quote(row.modelSlug, row.storageGb, row.condition, row.locale);
      return {
        ok: true,
        state: "already",
        modelName: quote?.modelName ?? row.modelSlug,
        storageGb: row.storageGb,
        condition: row.condition,
        locale: row.locale,
      };
    }
    if (purpose === "confirm" && (row.status !== "pending" || !row.pendingExpiresAt || Date.parse(row.pendingExpiresAt) <= Date.now())) {
      return { ok: true, state: "invalid" };
    }
    const quote = await deps.quote(row.modelSlug, row.storageGb, row.condition, row.locale);
    return {
      ok: true,
      state: "ready",
      modelName: quote?.modelName ?? row.modelSlug,
      storageGb: row.storageGb,
      condition: row.condition,
      locale: row.locale,
    };
  } catch {
    return { ok: false, code: "error" };
  }
}
