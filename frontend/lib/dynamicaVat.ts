"use client";

import { useCallback, useEffect, useState } from "react";

export const DYNAMICA_SLUG = "dynamica";
export const DYNAMICA_VAT_RATE = 0.18;
const STORAGE_KEY = "tradein-dynamica-include-vat";

export function applyDynamicaVat(
  slug: string,
  price: number | undefined | null,
  includeVat: boolean
): number | undefined {
  if (price == null) return undefined;
  if (includeVat && slug === DYNAMICA_SLUG) {
    return Math.round(price * (1 + DYNAMICA_VAT_RATE));
  }
  return price;
}

export function useDynamicaVat() {
  const [includeVat, setIncludeVatState] = useState(false);

  useEffect(() => {
    try {
      setIncludeVatState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setIncludeVat = useCallback((value: boolean) => {
    setIncludeVatState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { includeVat, setIncludeVat };
}
