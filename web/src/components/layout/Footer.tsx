import { getTranslations } from "next-intl/server";
import { footerNav } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function Footer() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="container-site flex flex-col gap-6 py-8">
        <nav aria-label={t("a11y.footerNav")}>
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {footerNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-control px-2 text-sm text-muted hover:text-foreground hover:underline"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted">{t("footer.disclaimer")}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p>
            © {year} {t("site.name")}. {t("footer.rights")}
          </p>
          <LanguageSwitcher
            label={t("language.switchTo")}
            ariaLabel={t("language.switchToLabel")}
          />
        </div>
      </div>
    </footer>
  );
}
