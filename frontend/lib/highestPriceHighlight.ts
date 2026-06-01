/** Subtle per-tier styling for the highest price in a comparison row. */

import { TIER_DIVIDER } from "@/lib/tierStyles";

export function formatPrice(n: number | undefined): string {
  if (n == null) return "—";
  return `₪${n.toLocaleString("he-IL")}`;
}

export function maxPriceInValues(values: Array<number | undefined | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

/** IDs/keys of entries tied for the highest price (empty if fewer than 2 prices). */
export function highestPriceKeys<T extends string>(
  entries: Array<{ key: T; price: number | undefined | null }>
): Set<T> {
  const priced = entries.filter((e) => e.price != null);
  if (priced.length < 2) return new Set();
  const max = maxPriceInValues(priced.map((e) => e.price));
  if (max == null) return new Set();
  return new Set(priced.filter((e) => e.price === max).map((e) => e.key));
}

function tierBestColors(tier: number) {
  const base = TIER_DIVIDER[tier] || TIER_DIVIDER[1];
  return {
    bg: base.tint.replace("0.08", "0.32"),
    ring: `${base.color}88`,
    text: "#f8fafc",
  };
}

export function highestPriceCellClass(isHighest: boolean): string {
  if (!isHighest) return "";
  return "font-semibold rounded-sm";
}

export function highestPriceCellStyle(
  isHighest: boolean,
  tier: number,
  baseStyle?: Record<string, string>
): Record<string, string> {
  if (!isHighest) return baseStyle ? { ...baseStyle } : {};
  const best = tierBestColors(tier);
  return {
    ...(baseStyle || {}),
    backgroundColor: best.bg,
    boxShadow: `inset 0 0 0 1.5px ${best.ring}`,
    color: best.text,
  };
}
