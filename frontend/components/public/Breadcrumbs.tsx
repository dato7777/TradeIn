import Link from "next/link";
import { localeHome, type PublicLocale } from "@/lib/publicCopy";

export function Breadcrumbs({
  locale,
  items,
}: {
  locale: PublicLocale;
  items: { href?: string; label: string }[];
}) {
  const home = locale === "he" ? "בית" : "Home";
  const trail = [{ href: localeHome(locale), label: home }, ...items];

  return (
    <nav aria-label={locale === "he" ? "מיקום בעמוד" : "Breadcrumb"}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-pub-muted">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-[10px] hover:text-pub-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center font-medium text-pub-fg" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
