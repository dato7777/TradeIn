import type { PublicLocale } from "@/lib/publicCopy";

export function formatIls(amount: number, locale: PublicLocale): string {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatStorage(gb: number): string {
  if (gb >= 1024 && gb % 1024 === 0) return `${gb / 1024} TB`;
  return `${gb} GB`;
}

export function formatUpdatedAgo(iso: string, locale: PublicLocale, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (locale === "he") {
    if (minutes < 1) return "עכשיו";
    if (minutes === 1) return "לפני דקה";
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.round(minutes / 60);
    if (hours <= 1) return "לפני שעה";
    if (hours < 24) return `לפני ${hours} שעות`;
    const days = Math.round(hours / 24);
    if (days <= 1) return "לפני יום";
    return `לפני ${days} ימים`;
  }
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours <= 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "1 day ago";
  return `${days} days ago`;
}

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://resparts.vercel.app").replace(/\/$/, "");
}
