export type PublicLocale = "he" | "en";

export const publicCopy = {
  he: {
    siteName: "השוואת טרייד-אין",
    skip: "דילוג לתוכן הראשי",
    homeAria: "לדף הבית",
    mainNav: "ניווט ראשי",
    footerNav: "ניווט תחתון",
    openMenu: "פתיחת תפריט",
    closeMenu: "סגירת תפריט",
    menuTitle: "תפריט",
    switchTo: "English",
    switchToAria: "Switch to English",
    title: "כמה שווה הטלפון שלכם?",
    subtitle:
      "בוחרים דגם, נפח אחסון ומצב — ורואים מי משלם הכי הרבה, מהמחיר הגבוה לנמוך.",
    badge: "החיפוש וההשוואה יעלו בקרוב.",
    stepsTitle: "שלושה צעדים פשוטים",
    steps: [
      { title: "בוחרים דגם", body: "אייפון או סמסונג, והדגם המדויק." },
      { title: "בוחרים נפח ומצב", body: "נפח האחסון ומצב המכשיר (A עד D)." },
      { title: "משווים ועוברים להצעה", body: "ההצעות מסודרות מהמחיר הגבוה לנמוך." },
    ],
    nav: [
      { href: "/sell/apple", label: "מכירת אייפון" },
      { href: "/sell/samsung", label: "מכירת סמסונג" },
      { href: "/how-it-works", label: "איך זה עובד" },
      { href: "/condition-guide", label: "מדריך מצב המכשיר" },
      { href: "/companies", label: "חברות" },
    ],
    footer: [
      { href: "/about", label: "אודות" },
      { href: "/methodology", label: "איך אנחנו מדרגים" },
      { href: "/faq", label: "שאלות נפוצות" },
      { href: "/privacy", label: "מדיניות פרטיות" },
      { href: "/terms", label: "תנאי שימוש" },
      { href: "/affiliate-disclosure", label: "גילוי נאות על עמלות" },
      { href: "/contact", label: "צור קשר" },
    ],
    disclaimer:
      "המחירים להמחשה בלבד. המחיר הסופי נקבע על ידי החברה לאחר בדיקת המכשיר.",
    rights: "כל הזכויות שמורות.",
    placeholderTitle: "הדף בדרך",
    placeholderBody: "התוכן הציבורי כאן יעלה בשלב הבא.",
    backHome: "חזרה לדף הבית",
  },
  en: {
    siteName: "Trade-in Compare",
    skip: "Skip to main content",
    homeAria: "Home",
    mainNav: "Main navigation",
    footerNav: "Footer navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuTitle: "Menu",
    switchTo: "עברית",
    switchToAria: "עבור לעברית",
    title: "What is your phone worth?",
    subtitle:
      "Pick the model, storage and condition, and see who pays the most, from highest to lowest.",
    badge: "Search and comparison are coming soon.",
    stepsTitle: "Three simple steps",
    steps: [
      { title: "Pick your model", body: "iPhone or Samsung, and the exact model." },
      { title: "Pick storage and condition", body: "Storage size and device condition (A to D)." },
      { title: "Compare and go to the offer", body: "Offers are sorted from highest to lowest price." },
    ],
    nav: [
      { href: "/en/sell/apple", label: "Sell iPhone" },
      { href: "/en/sell/samsung", label: "Sell Samsung" },
      { href: "/en/how-it-works", label: "How it works" },
      { href: "/en/condition-guide", label: "Condition guide" },
      { href: "/en/companies", label: "Companies" },
    ],
    footer: [
      { href: "/en/about", label: "About" },
      { href: "/en/methodology", label: "How we rank" },
      { href: "/en/faq", label: "FAQ" },
      { href: "/en/privacy", label: "Privacy policy" },
      { href: "/en/terms", label: "Terms of use" },
      { href: "/en/affiliate-disclosure", label: "Affiliate disclosure" },
      { href: "/en/contact", label: "Contact" },
    ],
    disclaimer:
      "Prices are indicative. The final price is set by the company after inspecting the device.",
    rights: "All rights reserved.",
    placeholderTitle: "This page is on the way",
    placeholderBody: "Public content here will land in the next phase.",
    backHome: "Back to home",
  },
} as const;

export function localeHome(locale: PublicLocale): string {
  return locale === "en" ? "/en" : "/";
}

export function localeSwitchHref(locale: PublicLocale): string {
  return locale === "en" ? "/" : "/en";
}
