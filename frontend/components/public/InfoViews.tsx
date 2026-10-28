import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { catalogCopy } from "@/lib/catalogCopy";
import type { PublicLocale } from "@/lib/publicCopy";

export function HowView({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <article className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.howTitle }]} />
      <h1 className="text-3xl font-bold md:text-4xl">{t.howTitle}</h1>
      <ol className="grid gap-4 md:grid-cols-3">
        {t.howSteps.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-pub-border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-pub-primary">{index + 1}</p>
            <h2 className="mt-2 text-xl font-semibold">{step.title}</h2>
            <p className="mt-2 text-pub-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function MethodologyView({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.methodologyTitle }]} />
      <h1 className="text-3xl font-bold">{t.methodologyTitle}</h1>
      {t.methodology.map((paragraph) => (
        <p key={paragraph} className="text-lg text-pub-muted">
          {paragraph}
        </p>
      ))}
    </article>
  );
}

export function FaqView({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.faqTitle }]} />
      <h1 className="text-3xl font-bold">{t.faqTitle}</h1>
      <div className="flex flex-col gap-3">
        {t.faq.map((item) => (
          <details key={item.q} className="rounded-xl border border-pub-border bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-semibold">{item.q}</summary>
            <p className="mt-2 text-pub-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </article>
  );
}

export function AboutView({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.aboutTitle }]} />
      <h1 className="text-3xl font-bold">{t.aboutTitle}</h1>
      <p className="text-lg text-pub-muted">{t.aboutBody}</p>
    </article>
  );
}

export function AffiliateView({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.affiliateTitle }]} />
      <h1 className="text-3xl font-bold">{t.affiliateTitle}</h1>
      <p className="inline-flex w-fit rounded-[10px] bg-pub-surface px-3 py-2 text-sm font-semibold text-pub-warning">
        {t.affiliateDraft}
      </p>
      <p className="text-lg text-pub-muted">{t.affiliateBody}</p>
    </article>
  );
}
