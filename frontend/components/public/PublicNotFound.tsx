import { catalogCopy } from "@/lib/catalogCopy";
import type { PublicLocale } from "@/lib/publicCopy";
import Link from "next/link";
import { localeHome } from "@/lib/publicCopy";

export function PublicNotFound({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">{t.notFoundTitle}</h1>
      <p className="text-pub-muted">{t.notFoundBody}</p>
      <Link
        href={localeHome(locale)}
        className="inline-flex min-h-11 items-center rounded-[10px] bg-pub-primary px-5 font-semibold text-white hover:bg-pub-primary-hover"
      >
        {locale === "he" ? "חזרה לדף הבית" : "Back to home"}
      </Link>
    </div>
  );
}
