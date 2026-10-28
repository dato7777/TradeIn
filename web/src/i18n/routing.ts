import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
