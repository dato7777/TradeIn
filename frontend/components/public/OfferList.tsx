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
              className={`scroll-mt-24 rounded-xl border border-pub-border bg-white p-5 shadow-sm`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-xl font-bold">{name}</h3>
                {isBest ? (
                  <span className="rounded-full bg-pub-best px-3 py-1 text-sm font-semibold text-pub-best-fg">
                    {t.bestPrice}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-4xl font-bold tracking-tight text-pub-fg">
                {formatIls(offer.price, locale)}
              </p>
              {index === 0 && offers.length > 1 ? (
                <p className="mt-3 text-sm font-semibold text-pub-primary">{t.moreBelow}</p>
              ) : null}
              <p className="mt-2 text-sm text-pub-muted">{t.updated(formatUpdatedAgo(offer.last_updated_at, locale))}</p>
              {offer.is_stale ? <p className="mt-1 text-sm font-medium text-pub-warning">{t.stale}</p> : null}
              <dl className="mt-4 grid gap-2 text-sm">
                <div>
                  <dt className="font-semibold">{t.payout}</dt>
                  <dd className="text-pub-muted">
                    {methodList(locale, "payout", offer.payout_methods)}
                    {payoutTime ? ` · ${payoutTime}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">{t.delivery}</dt>
                  <dd className="text-pub-muted">{methodList(locale, "delivery", offer.delivery_methods)}</dd>
                </div>
              </dl>
              <details className="mt-4 rounded-[10px] border border-pub-border bg-pub-surface p-3">
                <summary className="min-h-11 cursor-pointer font-semibold">{t.policySummary(grade)}</summary>
                <div className="mt-2 text-sm text-pub-muted">
                  {offer.company_grade_label ? (
                    <p>
                      {t.gradeLabel}: {offer.company_grade_label}
                    </p>
                  ) : null}
                  <p className="mt-1">{policy || t.noPolicy}</p>
                  {policyHref ? (
                    <a
                      href={policyHref}
                      className="mt-2 inline-flex min-h-11 items-center text-pub-primary underline"
                      rel="noopener"
                    >
                      {t.website}
                    </a>
                  ) : null}
                </div>
              </details>
              <p className="mt-4 text-sm text-pub-muted">{t.disclosure}</p>
              <p className="mt-1 text-sm text-pub-muted">{t.indicative}</p>
              <p className="mt-4">
                <a
                  href={`/go/${offer.offer_ref}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-pub-cta px-5 text-base font-semibold text-white hover:bg-pub-cta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary sm:w-fit"
                >
                  {t.goToOffer}
                  <span className="sr-only"> {t.newTab}</span>
                </a>
              </p>
              <p className="mt-2">
                <Link
                  href={localePath(locale, `/companies/${offer.company_slug}`)}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-pub-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
                >
                  {name}
                </Link>
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
