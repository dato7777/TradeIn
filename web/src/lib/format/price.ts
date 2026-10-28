import type { Locale } from "@/i18n/routing";

const formatters: Record<Locale, Intl.NumberFormat> = {
  he: new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }),
};

export function formatIls(amount: number, locale: Locale): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError("Prices must be integer ILS");
  }
  return formatters[locale].format(amount);
}

export function formatStorage(gb: number): string {
  if (!Number.isSafeInteger(gb) || gb <= 0) {
    throw new RangeError("Storage must be a positive integer of GB");
  }
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`;
}
