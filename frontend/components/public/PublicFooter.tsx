import Link from "next/link";
import {
  localeSwitchHref,
  publicCopy,
  type PublicLocale,
} from "@/lib/publicCopy";

export function PublicFooter({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-pub-border bg-pub-surface">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6">
        <nav aria-label={t.footerNav}>
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {t.footer.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-2 text-sm text-pub-muted hover:text-pub-fg hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-pub-muted">{t.disclaimer}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-pub-muted">
          <p>
            © {year} {t.siteName}. {t.rights}
          </p>
          <Link
            href={localeSwitchHref(locale)}
            aria-label={t.switchToAria}
            className="inline-flex min-h-11 items-center rounded-[10px] px-3 font-medium hover:bg-white hover:text-pub-fg"
          >
            {t.switchTo}
          </Link>
        </div>
      </div>
    </footer>
  );
}
