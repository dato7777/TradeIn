import { Heebo } from "next/font/google";
import { publicCopy, type PublicLocale } from "@/lib/publicCopy";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export function PublicShell({
  locale,
  children,
}: {
  locale: PublicLocale;
  children: React.ReactNode;
}) {
  const t = publicCopy[locale];

  return (
    <div
      lang={locale}
      dir={locale === "he" ? "rtl" : "ltr"}
      className={`${heebo.className} flex min-h-dvh flex-col bg-pub-bg text-pub-fg antialiased`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-pub-primary focus:px-4 focus:py-3 focus:text-white"
      >
        {t.skip}
      </a>
      <PublicHeader locale={locale} />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
