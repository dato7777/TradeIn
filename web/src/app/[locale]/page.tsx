import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: { he: "/", en: "/en", "x-default": "/" },
    },
  };
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-site flex flex-col gap-4 py-12 md:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-muted text-pretty">{t("subtitle")}</p>
          <p className="inline-flex w-fit rounded-control bg-best-bg px-3 py-2 text-sm font-medium text-best-fg">
            {t("comingSoon")}
          </p>
        </div>
      </section>

      <section aria-labelledby="steps-title" className="container-site py-12">
        <h2 id="steps-title" className="mb-6 text-2xl font-bold">
          {t("stepsTitle")}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-card border border-border bg-background p-5 shadow-card"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
