import Link from "next/link";
import { ModelCard } from "@/components/public/ModelCard";
import { ModelSearch } from "@/components/public/ModelSearch";
import { brandLabel, catalogCopy } from "@/lib/catalogCopy";
import { publicModelName } from "@/lib/public/modelName";
import { publicCopy, type PublicLocale } from "@/lib/publicCopy";
import { listBrands, listModels } from "@/lib/public/catalog";
import { brandPath } from "@/lib/public/paths";

export async function PublicHome({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];
  const c = catalogCopy[locale];
  const [brands, apple, samsung] = await Promise.all([
    listBrands(),
    listModels("apple", { limit: 6, offset: 0 }),
    listModels("samsung", { limit: 6, offset: 0 }),
  ]);
  const popular = [...apple, ...samsung];

  return (
    <>
      <section className="border-b border-pub-border bg-pub-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-12 sm:px-6 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t.title}</h1>
          <p className="max-w-2xl text-lg text-pub-muted">{t.subtitle}</p>
          <p className="inline-flex w-fit rounded-[10px] bg-pub-best px-3 py-2 text-sm font-medium text-pub-best-fg">
            {t.badge}
          </p>
          <ModelSearch locale={locale} />
        </div>
      </section>

      <section aria-labelledby="brands-title" className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
        <h2 id="brands-title" className="mb-6 text-2xl font-bold">
          {c.brandsTitle}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <li key={brand.brand}>
              <Link
                href={brandPath(locale, brand.brand)}
                className="flex min-h-[88px] flex-col justify-center rounded-xl border border-pub-border bg-white p-5 shadow-sm hover:border-pub-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
              >
                <span className="text-2xl font-bold">{brandLabel(locale, brand.brand)}</span>
                <span className="text-pub-muted">{c.modelsCount(brand.model_count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {popular.length > 0 ? (
        <section aria-labelledby="popular-title" className="mx-auto w-full max-w-[1200px] px-4 pb-4 sm:px-6">
          <h2 id="popular-title" className="mb-6 text-2xl font-bold">
            {c.popularTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((model) => (
              <ModelCard
                key={model.model_slug}
                locale={locale}
                brand={model.brand}
                slug={model.model_slug}
                name={publicModelName(locale, model.display_name_he, model.display_name_en)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="steps-title" className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
        <h2 id="steps-title" className="mb-6 text-2xl font-bold">
          {t.stepsTitle}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-xl border border-pub-border bg-pub-bg p-5 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-primary text-lg font-bold text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-pub-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
