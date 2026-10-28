import { getTranslations } from "next-intl/server";
import { headerNav } from "@/config/site";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileDrawer } from "./MobileDrawer";
import { NavLink } from "./NavLink";

export async function Header() {
  const t = await getTranslations();
  const items = headerNav.map((item) => ({
    href: item.href,
    label: t(item.labelKey),
  }));
  const languageSwitcher = (
    <LanguageSwitcher
      label={t("language.switchTo")}
      ariaLabel={t("language.switchToLabel")}
    />
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Logo name={t("site.name")} homeLabel={t("a11y.home")} />

        <nav aria-label={t("a11y.mainNav")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden lg:block">{languageSwitcher}</div>
          <MobileDrawer
            items={items}
            labels={{
              open: t("a11y.openMenu"),
              close: t("a11y.closeMenu"),
              title: t("a11y.menuTitle"),
              nav: t("a11y.mainNav"),
            }}
            footer={languageSwitcher}
          />
        </div>
      </div>
    </header>
  );
}
