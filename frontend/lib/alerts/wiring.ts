import "server-only";
import { alertConfig, AlertConfigError, type AlertConfig } from "@/lib/alerts/config";
import { consoleProvider, memoryProvider, resendProvider } from "@/lib/alerts/provider";
import { failClosedLimiter, memoryLimiter, upstashLimiter, type AlertLimiter } from "@/lib/alerts/rateLimit";
import { alertRepository } from "@/lib/alerts/repository";
import type { AlertDeps } from "@/lib/alerts/service";
import type { EmailProvider, Grade, Locale, PriceQuote } from "@/lib/alerts/types";
import { getModel, getOffers } from "@/lib/public/catalog";
import { publicModelName } from "@/lib/public/modelName";
import { brandSchema } from "@/lib/public/schemas";

function mailerFor(config: AlertConfig): EmailProvider {
  if (config.provider === "memory") return memoryProvider();
  if (config.provider === "console") return consoleProvider();
  if (!config.resendApiKey) throw new AlertConfigError();
  return resendProvider(config.resendApiKey);
}

function limiterFor(config: AlertConfig): AlertLimiter {
  if (process.env.NODE_ENV !== "production" && process.env.ALERT_RATE_LIMIT === "memory") {
    return memoryLimiter(() => Date.now(), config.maxConfirmationsPerDay);
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return failClosedLimiter;
  return upstashLimiter(config.maxConfirmationsPerDay);
}

export async function quotePhone(
  modelSlug: string,
  storageGb: number,
  grade: Grade,
  locale: Locale,
): Promise<PriceQuote | null> {
  const model = await getModel(modelSlug);
  if (!model || !model.storage_options.includes(storageGb)) return null;
  const brand = brandSchema.safeParse(model.brand);
  if (!brand.success) return null;
  const offers = await getOffers({ modelSlug, storageGb, grade });
  const fresh = offers.filter((offer) => !offer.is_stale).sort((a, b) => b.price - a.price);
  return {
    current: fresh[0]?.price ?? null,
    top: fresh.slice(0, 3).map((offer) => ({
      company: locale === "he" ? offer.company_name_he : offer.company_name_en,
      price: offer.price,
    })),
    modelName: publicModelName(locale, model.display_name_he, model.display_name_en),
    brand: brand.data,
  };
}

export async function phoneExists(modelSlug: string, storageGb: number): Promise<boolean> {
  const model = await getModel(modelSlug);
  return Boolean(model && model.storage_options.includes(storageGb));
}

export function productionDeps(): AlertDeps {
  const config = alertConfig();
  return {
    config,
    repo: alertRepository(),
    limiter: limiterFor(config),
    mailer: mailerFor(config),
    phoneExists: (modelSlug, storageGb) => phoneExists(modelSlug, storageGb),
    quote: quotePhone,
  };
}
