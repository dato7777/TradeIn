import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { clientEnv } from "@/env/client";
import { localeDirection, routing, type Locale } from "@/i18n/routing";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });

  return {
    metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t("site.name"), template: `%s | ${t("site.name")}` },
    description: t("site.tagline"),
    // TODO(launch): allow indexing once the catalog is live.
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  // Every page renders per request so each response gets a fresh CSP nonce.
  await connection();

  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale });
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      dir={localeDirection(locale as Locale)}
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          {t("a11y.skipToContent")}
        </a>
        <NextIntlClientProvider
          locale={locale}
          messages={{ errors: messages.errors }}
        >
          <Header />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
