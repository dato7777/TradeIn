"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  localeHome,
  localeSwitchHref,
  publicCopy,
  type PublicLocale,
} from "@/lib/publicCopy";

function Logo({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];
  return (
    <Link
      href={localeHome(locale)}
      aria-label={`${t.siteName} – ${t.homeAria}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] font-bold text-pub-fg"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0" fill="none">
        <rect width="32" height="32" rx="9" fill="#1D4ED8" />
        <rect x="10" y="6" width="12" height="20" rx="3" stroke="#fff" strokeWidth="2" />
        <path
          d="M13.5 17.5l2 2 3.5-4"
          stroke="#ECFDF5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="whitespace-nowrap text-lg leading-none">{t.siteName}</span>
    </Link>
  );
}

export function PublicHeader({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-pub-border bg-pub-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo locale={locale} />

        <nav aria-label={t.mainNav} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {t.nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-[10px] px-3 text-sm font-medium hover:bg-pub-surface ${
                      active ? "font-semibold text-pub-primary" : "text-pub-muted hover:text-pub-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={localeSwitchHref(locale)}
            hrefLang={locale === "he" ? "en" : "he"}
            lang={locale === "he" ? "en" : "he"}
            aria-label={t.switchToAria}
            className="hidden min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-pub-muted hover:bg-pub-surface hover:text-pub-fg lg:inline-flex"
          >
            {t.switchTo}
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-pub-fg hover:bg-pub-surface lg:hidden"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <span aria-hidden="true" className="text-2xl leading-none">
                ×
              </span>
            ) : (
              <span aria-hidden="true" className="text-xl leading-none">
                ☰
              </span>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-pub-border bg-pub-bg lg:hidden">
          <nav aria-label={t.mainNav} className="mx-auto max-w-[1200px] px-2 py-2">
            <p className="px-3 py-2 text-sm font-semibold text-pub-fg">{t.menuTitle}</p>
            <ul className="flex flex-col">
              {t.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-[10px] px-3 text-base text-pub-fg hover:bg-pub-surface"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={localeSwitchHref(locale)}
                  className="flex min-h-11 items-center rounded-[10px] px-3 text-base text-pub-muted hover:bg-pub-surface"
                  onClick={() => setOpen(false)}
                >
                  {t.switchTo}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
