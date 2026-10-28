import { NextResponse } from "next/server";
import { catalogCopy } from "@/lib/catalogCopy";
import { siteOrigin } from "@/lib/public/format";
import {
  buildTrackedUrl,
  isNonClick,
  localeFromPath,
  OutboundUrlError,
  safeReferrerPath,
  uuidv7,
} from "@/lib/public/outbound";
import { allowClick, clientIp } from "@/lib/public/rateLimit";
import { ClickLogError, recordClick, resolveOffer, trackingSource } from "@/lib/server/clicks";
import type { PublicLocale } from "@/lib/publicCopy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFER_REF = /^[0-9a-f]{24}$/;

function headers(extra?: Record<string, string>): Headers {
  const result = new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  });
  return result;
}

function page(locale: PublicLocale, status: number, title: string, body: string, back: string | null, extra?: Record<string, string>) {
  const t = catalogCopy[locale];
  const backLink =
    back && back.startsWith("/") && !back.includes('"') && !back.includes("<")
      ? `<p><a href="${back}">${t.goBack}</a></p>`
      : "";
  const html = `<!doctype html><html lang="${locale}" dir="${locale === "he" ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title><h1>${title}</h1><p>${body}</p>${backLink}<p><a href="${locale === "en" ? "/en" : "/"}">${t.goHome}</a></p>`;
  return new NextResponse(html, {
    status,
    headers: headers({ "Content-Type": "text/html; charset=utf-8", ...extra }),
  });
}

export function HEAD() {
  return new NextResponse(null, { status: 204, headers: headers() });
}

export async function GET(request: Request, context: { params: { offerRef: string } }) {
  if (isNonClick(request.method, request.headers)) {
    return new NextResponse(null, { status: 204, headers: headers() });
  }

  const ip = clientIp(request.headers.get("x-forwarded-for"));
  const limit = allowClick(ip ?? "missing");
  const requestOrigin = new URL(request.url).origin;
  const host = request.headers.get("host");
  const allowedOrigins = [siteOrigin(), requestOrigin];
  if (host && /^[A-Za-z0-9.:-]+$/.test(host)) {
    allowedOrigins.push(`${new URL(request.url).protocol}//${host}`);
  }
  const referrerPath = safeReferrerPath(request.headers.get("referer"), allowedOrigins);
  const locale = localeFromPath(referrerPath);
  const t = catalogCopy[locale];
  if (!limit.ok) {
    return page(locale, 429, t.goLimitedTitle, t.goLimitedBody, referrerPath, { "Retry-After": String(limit.retryAfter) });
  }

  const offerRef = context.params.offerRef;
  if (!OFFER_REF.test(offerRef)) {
    return page(locale, 404, t.goMissingTitle, t.goMissingBody, referrerPath);
  }

  try {
    const offer = await resolveOffer(offerRef);
    if (!offer) return page(locale, 404, t.goMissingTitle, t.goMissingBody, referrerPath);

    const clickId = uuidv7();
    let link: ReturnType<typeof buildTrackedUrl>;
    try {
      link = buildTrackedUrl({
        destination: offer.destination_url,
        allowedHosts: offer.allowed_hosts,
        trackingMode: offer.tracking_mode,
        clickIdParam: offer.click_id_param,
        staticParams: offer.static_params,
        utmSource: trackingSource(offer.utm_source_override),
        brand: offer.brand,
        modelSlug: offer.model_slug,
        storageGb: offer.storage_gb,
        grade: offer.grade,
        clickId,
      });
    } catch (error) {
      if (error instanceof OutboundUrlError) {
        console.error("outbound destination rejected", offerRef);
        return page(locale, 404, t.goMissingTitle, t.goMissingBody, referrerPath);
      }
      throw error;
    }

    try {
      await recordClick({
        clickId,
        offerRef,
        locale,
        ip,
        ua: request.headers.get("user-agent") ?? "",
        referrerPath,
        link,
      });
    } catch {
      console.error("outbound click was not logged", offerRef);
    }

    const responseHeaders = headers({ Location: link.href });
    return new NextResponse(null, { status: 302, headers: responseHeaders });
  } catch (error) {
    if (error instanceof ClickLogError) {
      console.error("outbound offer could not be resolved", offerRef);
      return page(locale, 503, t.goUnavailableTitle, t.goUnavailableBody, referrerPath);
    }
    console.error("outbound redirect failed", offerRef);
    return page(locale, 503, t.goUnavailableTitle, t.goUnavailableBody, referrerPath);
  }
}
