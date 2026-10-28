"use client";

import { usePathname } from "next/navigation";
import { catalogCopy } from "@/lib/catalogCopy";

export default function PublicSegmentError({ reset }: { reset: () => void }) {
  const path = usePathname() || "/";
  const locale = path === "/en" || path.startsWith("/en/") ? "en" : "he";
  const t = catalogCopy[locale];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">{t.errorTitle}</h1>
      <p className="text-pub-muted">{t.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center rounded-[10px] bg-pub-primary px-5 font-semibold text-white hover:bg-pub-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
      >
        {t.retry}
      </button>
    </div>
  );
}
