import type { PublicLocale } from "@/lib/publicCopy";

const payout = {
  he: {
    bank_transfer: "העברה בנקאית",
    store_credit: "זיכוי בחנות",
    gift_card: "תו קנייה",
    bill_credit: "זיכוי בחשבון",
    cash: "מזומן",
  },
  en: {
    bank_transfer: "Bank transfer",
    store_credit: "Store credit",
    gift_card: "Gift card",
    bill_credit: "Bill credit",
    cash: "Cash",
  },
} as const;

const delivery = {
  he: {
    mail: "דואר",
    courier: "שליח",
    drop_off: "הפקדה בנקודה",
    in_store: "בחנות",
  },
  en: {
    mail: "Mail",
    courier: "Courier",
    drop_off: "Drop-off",
    in_store: "In store",
  },
} as const;

export const catalogCopy = {
  he: {
    searchLabel: "חיפוש דגם",
    searchPlaceholder: "לדוגמה: iPhone 15 או Galaxy S24",
    searchAria: "חיפוש דגם",
    searchResults: "תוצאות חיפוש",
    searchEmpty: "לא נמצאו דגמים",
    searchError: "החיפוש לא זמין כרגע. נסו שוב.",
    brandsTitle: "בחרו מותג",
    popularTitle: "דגמים נפוצים",
    modelsCount: (n: number) => `${n} דגמים`,
    brandApple: "אפל",
    brandSamsung: "סמסונג",
    sellBrand: (name: string) => `מכירת ${name}`,
    storageLegend: "נפח אחסון",
    conditionLegend: "מצב המכשיר",
    confirm: "הצגת הצעות",
    confirmHint: "בחרו נפח אחסון ומצב, ואז לחצו כדי לראות מחירים. לא מוצג מחיר לפני האישור.",
    pendingNote: "ההצעות שמוצגות שייכות לבחירה שאושרה. לחצו שוב כדי לעדכן.",
    offersTitle: "הצעות, מהמחיר הגבוה לנמוך",
    bestPrice: "המחיר הגבוה",
    stale: "ייתכן שהמחיר לא מעודכן",
    updated: (when: string) => `עודכן ${when}`,
    noOffers: "אין הצעות לשילוב הזה",
    tryInstead: "שילובים קרובים",
    policySummary: (grade: string) => `מדיניות המצב ${grade} בחברה`,
    noPolicy: "לחברה אין כאן תיאור מצב משלה.",
    disclosure: "ייתכן שנקבל עמלה. היא לא משפיעה על סדר ההצעות.",
    ctaLater: "המעבר לאתר החברה יתווסף בשלב הבא. כאן רואים רק את המחיר להשוואה.",
    payout: "תשלום",
    delivery: "מסירה",
    notSpecified: "לא צוין עדיין",
    companiesTitle: "החברות בהשוואה",
    companiesIntro: "החברות שההצעות שלהן מופיעות אחרי שבוחרים דגם, נפח ומצב.",
    offerCount: (n: number) => (n === 1 ? "הצעה אחת" : `${n} הצעות`),
    conditionGuideTitle: "מדריך מצב המכשיר",
    conditionGuideIntro:
      "כל החברות ממופות לאותו סולם A עד D, כדי שאפשר יהיה להשוות. השם שהחברה עצמה נותנת לדרגה מופיע ליד השם שלה.",
    howTitle: "איך זה עובד",
    howSteps: [
      { title: "בוחרים דגם", body: "מחפשים אייפון או סמסונג, או נכנסים דרך המותג." },
      { title: "בוחרים נפח ומצב", body: "שום מחיר לא מופיע לפני שלוחצים על הצגת הצעות." },
      { title: "משווים", body: "ההצעות מסודרות מהמחיר הגבוה לנמוך. שוויון נשבר לפי עדכניות המחיר." },
    ],
    methodologyTitle: "איך אנחנו מדרגים",
    methodology: [
      "ההצעות מסודרות לפי המחיר בלבד, מהגבוה לנמוך. אם שני מחירים שווים, המחיר שעודכן לאחרונה מופיע קודם.",
      "עמלה, אם תהיה, לא משנה את הסדר.",
      "המחיר מוצג כפי שהחברה שומרת אותו. הוא עשוי לכלול מע״מ או לא, לפי איך שהחברה מפרסמת אותו.",
      "המחיר להמחשה. המחיר הסופי נקבע אצל החברה אחרי בדיקת המכשיר.",
    ],
    faqTitle: "שאלות נפוצות",
    faq: [
      {
        q: "למה אין מחיר לפני שאני בוחר נפח ומצב?",
        a: "המחיר תלוי בדגם, בנפח ובמצב. בלי שלושתם ההשוואה לא נכונה, ולכן שום הצעה לא מוצגת מראש.",
      },
      {
        q: "האם הסדר מושפע ממי שמשלם עמלה?",
        a: "לא. הסדר הוא לפי המחיר, ושוויון נשבר לפי עדכניות.",
      },
      {
        q: "האם המחיר באתר הוא המחיר שאקבל?",
        a: "לא. זה מחיר להמחשה. החברה קובעת את המחיר הסופי אחרי שבודקת את המכשיר.",
      },
    ],
    aboutTitle: "אודות",
    aboutBody:
      "האתר משווה מחירי טרייד-אין לטלפונים של אפל וסמסונג, במקום אחד, מהמחיר הגבוה לנמוך.",
    affiliateTitle: "גילוי נאות על עמלות",
    affiliateDraft: "טיוטה לסקירה משפטית.",
    affiliateBody:
      "ייתכן שנקבל עמלה אם תמשיכו לחברה דרך האתר. העמלה לא משנה את סדר ההצעות. המעבר עצמו עדיין לא פעיל.",
    errorTitle: "משהו השתבש",
    errorBody: "לא הצלחנו לטעון את ההשוואה. נסו שוב.",
    retry: "נסו שוב",
    notFoundTitle: "העמוד לא נמצא",
    notFoundBody: "אין דגם או עמוד בכתובת הזו.",
    website: "אתר החברה",
    gradeLabel: "השם אצל החברה",
  },
  en: {
    searchLabel: "Search for a model",
    searchPlaceholder: "For example: iPhone 15 or Galaxy S24",
    searchAria: "Search for a model",
    searchResults: "Search results",
    searchEmpty: "No models found",
    searchError: "Search is unavailable right now. Try again.",
    brandsTitle: "Choose a brand",
    popularTitle: "Popular models",
    modelsCount: (n: number) => `${n} models`,
    brandApple: "Apple",
    brandSamsung: "Samsung",
    sellBrand: (name: string) => `Sell ${name}`,
    storageLegend: "Storage",
    conditionLegend: "Condition",
    confirm: "Show offers",
    confirmHint: "Pick storage and condition, then press the button to see prices. Nothing is shown before that.",
    pendingNote: "The offers below match the confirmed choice. Press the button again to update them.",
    offersTitle: "Offers, highest price first",
    bestPrice: "Highest price",
    stale: "This price may be out of date",
    updated: (when: string) => `Updated ${when}`,
    noOffers: "No offers for this combination",
    tryInstead: "Nearby combinations",
    policySummary: (grade: string) => `This company's policy for grade ${grade}`,
    noPolicy: "This company has no condition note here yet.",
    disclosure: "We may earn a commission. It does not change the order of offers.",
    ctaLater: "The link to the company comes in the next step. This page is for comparing the price.",
    payout: "Payout",
    delivery: "Handover",
    notSpecified: "Not listed yet",
    companiesTitle: "Companies in the comparison",
    companiesIntro: "Companies whose offers appear after you pick a model, storage and condition.",
    offerCount: (n: number) => (n === 1 ? "1 offer" : `${n} offers`),
    conditionGuideTitle: "Condition guide",
    conditionGuideIntro:
      "Every company is mapped onto the same A–D scale so the prices can be compared. The name that company uses is shown next to it.",
    howTitle: "How it works",
    howSteps: [
      { title: "Pick a model", body: "Search for an iPhone or a Samsung, or start from the brand." },
      { title: "Pick storage and condition", body: "No price is shown until you press Show offers." },
      { title: "Compare", body: "Offers are sorted from highest to lowest price. A tie goes to the more recently updated price." },
    ],
    methodologyTitle: "How we rank",
    methodology: [
      "Offers are sorted by price only, highest first. If two prices are equal, the one updated more recently comes first.",
      "A commission, if there is one, does not change the order.",
      "The price is shown as the company stores it. It may or may not include VAT, depending on how that company publishes it.",
      "The price is indicative. The company sets the final price after inspecting the phone.",
    ],
    faqTitle: "FAQ",
    faq: [
      {
        q: "Why is there no price before I pick storage and condition?",
        a: "The price depends on the model, the storage and the condition. Without all three, the comparison would be wrong, so no offer is shown up front.",
      },
      {
        q: "Does commission change the order?",
        a: "No. The order is by price, and a tie is broken by how recently the price was updated.",
      },
      {
        q: "Is the price on this site the price I will get?",
        a: "No. It is indicative. The company sets the final price after inspecting the phone.",
      },
    ],
    aboutTitle: "About",
    aboutBody:
      "This site compares trade-in prices for Apple and Samsung phones in one place, from highest to lowest.",
    affiliateTitle: "Affiliate disclosure",
    affiliateDraft: "Draft pending legal review.",
    affiliateBody:
      "We may earn a commission if you continue to a company from this site. A commission does not change the order of offers. The link itself is not active yet.",
    errorTitle: "Something went wrong",
    errorBody: "The comparison could not be loaded. Try again.",
    retry: "Try again",
    notFoundTitle: "Page not found",
    notFoundBody: "There is no model or page at this address.",
    website: "Company website",
    gradeLabel: "Name at this company",
  },
} as const;

export function brandLabel(locale: PublicLocale, brand: string): string {
  const t = catalogCopy[locale];
  if (brand === "apple") return t.brandApple;
  if (brand === "samsung") return t.brandSamsung;
  return brand;
}

export function methodList(
  locale: PublicLocale,
  kind: "payout" | "delivery",
  keys: readonly string[],
): string {
  const table = kind === "payout" ? payout[locale] : delivery[locale];
  const labels = keys.map((key) => (key in table ? table[key as keyof typeof table] : null)).filter(Boolean);
  if (labels.length === 0) return catalogCopy[locale].notSpecified;
  return labels.join(", ");
}

export function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
