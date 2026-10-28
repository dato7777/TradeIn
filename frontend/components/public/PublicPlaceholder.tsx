import Link from "next/link";
import { localeHome, publicCopy, type PublicLocale } from "@/lib/publicCopy";

export function PublicPlaceholder({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">{t.placeholderTitle}</h1>
      <p className="text-pub-muted">{t.placeholderBody}</p>
      <Link
        href={localeHome(locale)}
        className="inline-flex min-h-11 items-center rounded-[10px] bg-pub-primary px-5 font-semibold text-white hover:bg-pub-primary-hover"
      >
        {t.backHome}
      </Link>
    </div>
  );
}
