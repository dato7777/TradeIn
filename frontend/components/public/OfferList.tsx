import Link from "next/link";
import { ScrollToTopOffer } from "@/components/public/ScrollToTopOffer";
import { catalogCopy, httpsUrl, methodList } from "@/lib/catalogCopy";
import { formatIls, formatStorage, formatUpdatedAgo } from "@/lib/public/format";
import { localePath } from "@/lib/public/paths";
import type { OfferRow } from "@/lib/public/schemas";
import type { PublicLocale } from "@/lib/publicCopy";

export function OfferList({
  locale,
  offers,
  grade,
  suggestions,
}: {
  locale: PublicLocale;
  offers: OfferRow[];
  grade: string;
  suggestions: { href: string; label: string }[];
}) {
  const t = catalogCopy[locale];
  const best = offers[0]?.price;

  if (offers.length === 0) {
    return (
      <section aria-labelledby="offers-title" className="flex flex-col gap-4">
        <h2 id="offers-title" className="text-2xl font-bold">
          {t.noOffers}
        </h2>
        {suggestions.length > 0 ? (
          <div>
            <h3 className="mb-2 font-semibold">{t.tryInstead}</h3>
            <ul className="flex flex-col gap-2">
              {suggestions.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-[10px] px-1 text-pub-primary underline hover:text-pub-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="offers-title" className="flex flex-col gap-4">
      <h2 id="offers-title" className="text-2xl font-bold">
        {t.offersTitle}
      </h2>
      <ScrollToTopOffer />
      <ol className="flex flex-col gap-4">
        {offers.map((offer, index) => {
          const name = locale === "he" ? offer.company_name_he : offer.company_name_en;
          const payoutTime = locale === "he" ? offer.payout_time_he : offer.payout_time_en;
          const policy = locale === "he" ? offer.policy_summary_he : offer.policy_summary_en;
          const policyHref = httpsUrl(offer.policy_url);
          const isBest = offer.price === best;
          return (
            <li
              key={offer.offer_ref}
              id={index === 0 ? "top-offer" : undefined}
              className="scroll-mt-24 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">
                      <Link
                        href={localePath(locale, `/companies/${offer.company_slug}`)}
                        className="rounded-[10px] hover:text-pub-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
                      >
                        {name}
                      </Link>
                    </h3>
                    {isBest ? (
                      <span className="rounded-full bg-pub-best px-2.5 py-0.5 text-sm font-semibold text-pub-best-fg">
                        {t.bestPrice}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-pub-fg">
                    {formatIls(offer.price, locale)}
                  </p>
                  <p className="mt-1 text-sm text-pub-muted">
                    {t.updated(formatUpdatedAgo(offer.last_updated_at, locale))}
                    {offer.is_stale ? <span className="font-medium text-pub-warning"> · {t.stale}</span> : null}
                  </p>
                  {index === 0 && offers.length > 1 ? (
                    <p className="mt-1 text-sm font-semibold text-pub-primary">{t.moreBelow}</p>
                  ) : null}
                </div>
                <a
                  href={`/go/${offer.offer_ref}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-pub-cta px-4 text-base font-semibold text-white hover:bg-pub-cta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
                >
                  {t.goToOffer}
                  <span className="sr-only"> {t.newTab}</span>
                </a>
              </div>
              <p className="mt-1.5 text-sm text-pub-muted">
                <span className="font-semibold text-pub-fg">{t.payout}:</span>{" "}
                {methodList(locale, "payout", offer.payout_methods)}
                {payoutTime ? ` · ${payoutTime}` : ""}
                <span className="px-1">·</span>
                <span className="font-semibold text-pub-fg">{t.delivery}:</span>{" "}
                {methodList(locale, "delivery", offer.delivery_methods)}
              </p>
              <details className="mt-1.5 rounded-[10px] border border-slate-300 bg-pub-surface px-3 py-1">
                <summary className="min-h-11 cursor-pointer font-semibold">{t.policySummary(grade)}</summary>
                <div className="pb-2 text-sm text-pub-muted">
                  {offer.company_grade_label ? (
                    <p>
                      {t.gradeLabel}: {offer.company_grade_label}
                    </p>
                  ) : null}
                  <p className="mt-1">{policy || t.noPolicy}</p>
                  {policyHref ? (
                    <a
                      href={policyHref}
                      className="mt-1 inline-flex min-h-11 items-center text-pub-primary underline"
                      rel="noopener"
                    >
                      {t.website}
                    </a>
                  ) : null}
                </div>
              </details>
              <p className="mt-1.5 text-xs leading-snug text-pub-muted">
                {t.disclosure} {t.indicative}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function suggestionLabel(
  locale: PublicLocale,
  storageGb: number,
  grade: string,
  gradeName: string,
): string {
  const storage = formatStorage(storageGb);
  return locale === "he" ? `${storage} · מצב ${grade} (${gradeName})` : `${storage} · grade ${grade} (${gradeName})`;
}
