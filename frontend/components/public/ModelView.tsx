import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { OfferList, suggestionLabel } from "@/components/public/OfferList";
import { OfferPicker } from "@/components/public/OfferPicker";
import { brandLabel, catalogCopy } from "@/lib/catalogCopy";
import { publicModelName } from "@/lib/public/modelName";
import { getModel, getOffers, listConditionGrades } from "@/lib/public/catalog";
import { formatStorage, siteOrigin } from "@/lib/public/format";
import { brandPath, modelPath } from "@/lib/public/paths";
import { brandSchema, gradeSchema, storageGbSchema, type GradeRow } from "@/lib/public/schemas";
import { publicCopy, type PublicLocale } from "@/lib/publicCopy";

const GRADES = ["A", "B", "C", "D"] as const;

export async function ModelView({
  locale,
  brand,
  modelSlug,
  storageParam,
  conditionParam,
}: {
  locale: PublicLocale;
  brand: string;
  modelSlug: string;
  storageParam?: string | string[];
  conditionParam?: string | string[];
}) {
  const parsedBrand = brandSchema.safeParse(brand);
  if (!parsedBrand.success) notFound();
  const model = await getModel(modelSlug);
  if (!model || model.brand !== parsedBrand.data) notFound();

  const grades = await listConditionGrades();
  const storageParsed = storageGbSchema.safeParse(firstQuery(storageParam));
  const gradeParsed = gradeSchema.safeParse(firstQuery(conditionParam) ?? "");
  const storage =
    storageParsed.success && model.storage_options.includes(storageParsed.data)
      ? storageParsed.data
      : null;
  const grade = gradeParsed.success ? gradeParsed.data : null;
  const confirmed = storage !== null && grade !== null;
  const offers = confirmed
    ? await getOffers({ modelSlug: model.model_slug, storageGb: storage, grade })
    : [];

  const t = catalogCopy[locale];
  const name = publicModelName(locale, model.display_name_he, model.display_name_en);
  const brandName = brandLabel(locale, model.brand);
  const action = modelPath(locale, model.brand, model.model_slug);
  const suggestions =
    confirmed && offers.length === 0
      ? nearbySuggestions(locale, action, model.storage_options, storage, grade, grades)
      : [];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { href: brandPath(locale, model.brand), label: t.sellBrand(brandName) },
          { label: name },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
        <p className="text-pub-muted">{publicCopy[locale].disclaimer}</p>
      </header>
      <OfferPicker
        locale={locale}
        action={action}
        storages={model.storage_options}
        grades={grades}
        storage={storage}
        grade={grade}
        showPendingNote={confirmed}
      />
      {confirmed && grade ? (
        <OfferList
          locale={locale}
          offers={offers}
          grade={grade}
          suggestions={suggestions}
          alert={{
            modelName: name,
            modelSlug: model.model_slug,
            storageGb: storage,
            grade,
            siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
          }}
        />
      ) : null}
    </div>
  );
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nearbySuggestions(
  locale: PublicLocale,
  action: string,
  storages: number[],
  storage: number,
  grade: string,
  grades: GradeRow[],
) {
  const gradeName = (code: string) => {
    const row = grades.find((item) => item.grade === code);
    if (!row) return code;
    return locale === "he" ? row.name_he : row.name_en;
  };
  const links: { href: string; label: string }[] = [];
  for (const gb of storages) {
    if (gb === storage) continue;
    links.push({
      href: `${action}?storage=${gb}&condition=${grade}`,
      label: suggestionLabel(locale, gb, grade, gradeName(grade)),
    });
  }
  const index = GRADES.indexOf(grade as (typeof GRADES)[number]);
  for (const next of [GRADES[index - 1], GRADES[index + 1]]) {
    if (!next) continue;
    links.push({
      href: `${action}?storage=${storage}&condition=${next}`,
      label: suggestionLabel(locale, storage, next, gradeName(next)),
    });
  }
  return links.slice(0, 6);
}

export async function modelMetadata(
  locale: PublicLocale,
  brand: string,
  modelSlug: string,
): Promise<Metadata> {
  const parsedBrand = brandSchema.safeParse(brand);
  const model = parsedBrand.success ? await getModel(modelSlug) : null;
  const site = publicCopy[locale].siteName;
  if (!parsedBrand.success || !model || model.brand !== parsedBrand.data) {
    return { title: site, robots: { index: false, follow: false } };
  }
  const name = publicModelName(locale, model.display_name_he, model.display_name_en);
  const origin = siteOrigin();
  const he = `${origin}/sell/${model.brand}/${model.model_slug}`;
  const en = `${origin}/en/sell/${model.brand}/${model.model_slug}`;
  return {
    title: `${name} | ${site}`,
    description: publicCopy[locale].subtitle,
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "he" ? he : en,
      languages: { he, en },
    },
  };
}
