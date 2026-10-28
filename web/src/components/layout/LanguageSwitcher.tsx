"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  label: string;
  ariaLabel: string;
  className?: string;
};

export function LanguageSwitcher({
  label,
  ariaLabel,
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const target: Locale = locale === "he" ? "en" : "he";

  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      lang={target}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}
