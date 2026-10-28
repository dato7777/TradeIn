import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="container-site flex flex-1 flex-col items-start justify-center gap-4 py-16">
      <p className="text-sm font-semibold text-primary tabular-nums">404</p>
      <h1 className="text-3xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-muted">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
