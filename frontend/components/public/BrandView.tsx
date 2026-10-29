import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ModelCard } from "@/components/public/ModelCard";
import { brandLabel, catalogCopy } from "@/lib/catalogCopy";
import { compareModelNames, publicModelName } from "@/lib/public/modelName";
import { listModels } from "@/lib/public/catalog";
import { brandSchema } from "@/lib/public/schemas";
import type { PublicLocale } from "@/lib/publicCopy";

export async function BrandView({ locale, brand }: { locale: PublicLocale; brand: string }) {
  const parsed = brandSchema.safeParse(brand);
  if (!parsed.success) notFound();
  const first = await listModels(parsed.data, { limit: 100, offset: 0 });
  const rest = first.length < 100 ? [] : await listModels(parsed.data, { limit: 100, offset: 100 });
  const models = [...first, ...rest].sort((a, b) =>
    compareModelNames(a.display_name_en, b.display_name_en, "en"),
  );
  const t = catalogCopy[locale];
  const name = brandLabel(locale, parsed.data);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.sellBrand(name) }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{t.sellBrand(name)}</h1>
        <p className="text-pub-muted">{t.modelsCount(models.length)}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <ModelCard
            key={model.model_slug}
            locale={locale}
            brand={model.brand}
            slug={model.model_slug}
            name={publicModelName(locale, model.display_name_he, model.display_name_en)}
          />
        ))}
      </ul>
    </div>
  );
}

export function brandTitle(locale: PublicLocale, brand: string): string | null {
  const parsed = brandSchema.safeParse(brand);
  if (!parsed.success) return null;
  return catalogCopy[locale].sellBrand(brandLabel(locale, parsed.data));
}
