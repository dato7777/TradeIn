// TODO(content): the public brand name and domain are not decided yet.
// The display name comes from messages (site.name); the URL from NEXT_PUBLIC_SITE_URL.

export type NavItem = {
  href: string;
  labelKey: string;
};

export const headerNav: ReadonlyArray<NavItem> = [
  { href: "/sell/apple", labelKey: "nav.sellApple" },
  { href: "/sell/samsung", labelKey: "nav.sellSamsung" },
  { href: "/how-it-works", labelKey: "nav.howItWorks" },
  { href: "/condition-guide", labelKey: "nav.conditionGuide" },
  { href: "/companies", labelKey: "nav.companies" },
];

export const footerNav: ReadonlyArray<NavItem> = [
  { href: "/about", labelKey: "footer.about" },
  { href: "/methodology", labelKey: "footer.methodology" },
  { href: "/faq", labelKey: "footer.faq" },
  { href: "/privacy", labelKey: "footer.privacy" },
  { href: "/terms", labelKey: "footer.terms" },
  { href: "/affiliate-disclosure", labelKey: "footer.affiliateDisclosure" },
  { href: "/contact", labelKey: "footer.contact" },
];
