import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { catalogCopy, httpsUrl, methodList } from "@/lib/catalogCopy";
import { listCompanies, listConditionGrades, listConditionPolicies } from "@/lib/public/catalog";
import { formatUpdatedAgo } from "@/lib/public/format";
import { localePath } from "@/lib/public/paths";
import { companySlugSchema, type CompanyRow, type GradeRow, type PolicyRow } from "@/lib/public/schemas";
import type { PublicLocale } from "@/lib/publicCopy";
import { notFound } from "next/navigation";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary";

export async function CompaniesView({ locale }: { locale: PublicLocale }) {
  const companies = await listCompanies();
  const t = catalogCopy[locale];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.companiesTitle }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{t.companiesTitle}</h1>
        <p className="max-w-2xl text-pub-muted">{t.companiesIntro}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {companies.map((company) => {
          const name = locale === "he" ? company.name_he : company.name_en;
          return (
            <li key={company.company_slug}>
              <Link
                href={localePath(locale, `/companies/${company.company_slug}`)}
                className={`flex min-h-11 flex-col justify-center rounded-xl border border-pub-border bg-white p-5 shadow-sm hover:border-pub-primary ${focus}`}
              >
                <span className="text-lg font-bold">{name}</span>
                <span className="text-sm text-pub-muted">{t.offerCount(company.offer_count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function CompanyView({ locale, slug }: { locale: PublicLocale; slug: string }) {
  const parsed = companySlugSchema.safeParse(slug);
  if (!parsed.success) notFound();
  const [companies, grades, policies] = await Promise.all([
    listCompanies(),
    listConditionGrades(),
    listConditionPolicies(),
  ]);
  const company = companies.find((row) => row.company_slug === parsed.data);
  if (!company) notFound();
  return <CompanyBody locale={locale} company={company} grades={grades} policies={policies} />;
}

function CompanyBody({
  locale,
  company,
  grades,
  policies,
}: {
  locale: PublicLocale;
  company: CompanyRow;
  grades: GradeRow[];
  policies: PolicyRow[];
}) {
  const t = catalogCopy[locale];
  const name = locale === "he" ? company.name_he : company.name_en;
  const payoutTime = locale === "he" ? company.payout_time_he : company.payout_time_en;
  const site = httpsUrl(company.website_url);
  const mine = policies.filter((row) => row.company_slug === company.company_slug);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs
        locale={locale}
        items={[{ href: localePath(locale, "/companies"), label: t.companiesTitle }, { label: name }]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
        <p className="text-pub-muted">{t.offerCount(company.offer_count)}</p>
        {company.last_updated_at ? (
          <p className="text-sm text-pub-muted">{t.updated(formatUpdatedAgo(company.last_updated_at, locale))}</p>
        ) : null}
      </header>
      <dl className="grid gap-4 rounded-xl border border-pub-border bg-white p-5 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">{t.payout}</dt>
          <dd className="text-pub-muted">
            {methodList(locale, "payout", company.payout_methods)}
            {payoutTime ? ` · ${payoutTime}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{t.delivery}</dt>
          <dd className="text-pub-muted">{methodList(locale, "delivery", company.delivery_methods)}</dd>
        </div>
      </dl>
      {site ? (
        <a href={site} rel="noopener" className={`inline-flex min-h-11 items-center text-pub-primary underline ${focus}`}>
          {t.website}
        </a>
      ) : null}
      <section aria-labelledby="company-grades" className="flex flex-col gap-3">
        <h2 id="company-grades" className="text-2xl font-bold">
          {t.conditionGuideTitle}
        </h2>
        <ul className="flex flex-col gap-3">
          {grades.map((grade) => {
            const policy = mine.find((row) => row.grade === grade.grade);
            const summary = locale === "he" ? policy?.summary_he : policy?.summary_en;
            return (
              <li key={grade.grade} className="rounded-xl border border-pub-border bg-pub-surface p-4">
                <h3 className="font-semibold">
                  {grade.grade} · {locale === "he" ? grade.name_he : grade.name_en}
                </h3>
                {policy?.company_grade_label ? (
                  <p className="mt-1 text-sm text-pub-muted">
                    {t.gradeLabel}: {policy.company_grade_label}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-pub-muted">{summary || t.noPolicy}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export async function ConditionGuideView({ locale }: { locale: PublicLocale }) {
  const [grades, policies, companies] = await Promise.all([
    listConditionGrades(),
    listConditionPolicies(),
    listCompanies(),
  ]);
  const t = catalogCopy[locale];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs locale={locale} items={[{ label: t.conditionGuideTitle }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{t.conditionGuideTitle}</h1>
        <p className="max-w-2xl text-pub-muted">{t.conditionGuideIntro}</p>
      </header>
      <div className="flex flex-col gap-6">
        {grades.map((grade) => (
          <section key={grade.grade} aria-labelledby={`grade-${grade.grade}`} className="flex flex-col gap-3">
            <h2 id={`grade-${grade.grade}`} className="text-2xl font-bold">
              {grade.grade} · {locale === "he" ? grade.name_he : grade.name_en}
            </h2>
            <p className="text-pub-muted">{locale === "he" ? grade.description_he : grade.description_en}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {companies.map((company) => {
                const policy = policies.find(
                  (row) => row.company_slug === company.company_slug && row.grade === grade.grade,
                );
                const name = locale === "he" ? company.name_he : company.name_en;
                return (
                  <li key={company.company_slug} className="rounded-xl border border-pub-border bg-white p-4">
                    <h3 className="font-semibold">
                      <Link href={localePath(locale, `/companies/${company.company_slug}`)} className="underline">
                        {name}
                      </Link>
                    </h3>
                    {policy?.company_grade_label ? (
                      <p className="mt-1 text-sm text-pub-muted">
                        {t.gradeLabel}: {policy.company_grade_label}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-pub-muted">{t.noPolicy}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
