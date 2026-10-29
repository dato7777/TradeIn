import type { Metadata } from "next";
import { AlertFlow } from "@/components/public/AlertFlow";
import { loadAlertPreview } from "@/app/actions/priceAlerts";
import { alertsCopy } from "@/lib/alertsCopy";
import type { PublicLocale } from "@/lib/publicCopy";

export const dynamic = "force-dynamic";

export function alertMetadata(locale: PublicLocale, purpose: "confirm" | "manage"): Metadata {
  const t = alertsCopy[locale];
  return {
    title: purpose === "confirm" ? t.confirmTitle : t.unsubTitle,
    robots: { index: false, follow: false },
  };
}

export async function AlertTokenPage({
  locale,
  purpose,
  token,
}: {
  locale: PublicLocale;
  purpose: "confirm" | "manage";
  token?: string | string[];
}) {
  const value = Array.isArray(token) ? token[0] ?? "" : token ?? "";
  const preview = await loadAlertPreview(value, purpose);
  return <AlertFlow locale={locale} purpose={purpose} token={value} preview={preview} />;
}
