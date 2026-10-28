import type { PublicLocale } from "@/lib/publicCopy";

export function localePath(locale: PublicLocale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") return normalized === "/" ? "/en" : `/en${normalized}`;
  return normalized;
}

export function modelPath(locale: PublicLocale, brand: string, slug: string): string {
  return localePath(locale, `/sell/${brand}/${slug}`);
}

export function brandPath(locale: PublicLocale, brand: string): string {
  return localePath(locale, `/sell/${brand}`);
}
