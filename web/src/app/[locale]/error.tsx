"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");

  return (
    <div className="container-site flex flex-1 flex-col items-start justify-center gap-4 py-16">
      <h1 className="text-3xl font-bold">{t("errorTitle")}</h1>
      <p className="text-muted">{t("errorBody")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {t("retry")}
      </button>
    </div>
  );
}
