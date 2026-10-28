import type { PublicLocale } from "@/lib/publicCopy";

const HEBREW = /[\u0590-\u05FF]/;

/** English product words, longest first, so "Pro Max" is not split into "Pro". */
const EN_TO_HE: [RegExp, string][] = [
  [/pro max/gi, "פרו מקס"],
  [/iphone/gi, "אייפון"],
  [/galaxy/gi, "גלקסי"],
  [/ultra/gi, "אולטרה"],
  [/plus/gi, "פלוס"],
  [/\+/g, " פלוס"],
  [/mini/gi, "מיני"],
  [/pro/gi, "פרו"],
  [/air/gi, "אייר"],
  [/fold/gi, "פולד"],
  [/flip/gi, "פליפ"],
  [/note/gi, "נוט"],
  [/edge/gi, "אדג׳"],
  [/lite/gi, "לייט"],
  [/active/gi, "אקטיב"],
  [/neo/gi, "ניאו"],
];

/** Hebrew spellings a shopper might type, longest first. */
const HE_TO_EN: [RegExp, string][] = [
  [/פרו\s*מקס/g, "pro max"],
  [/אייפון|איפון/g, "iphone"],
  [/גלאקסי|גלקסי/g, "galaxy"],
  [/סמסונג/g, "samsung"],
  [/אולטרה/g, "ultra"],
  [/פלוס/g, "plus"],
  [/מיני/g, "mini"],
  [/אייר/g, "air"],
  [/פולד/g, "fold"],
  [/פליפ/g, "flip"],
  [/נוט/g, "note"],
  [/אדג[׳']?/g, "edge"],
  [/לייט/g, "lite"],
  [/אקטיב/g, "active"],
  [/ניאו/g, "neo"],
  [/פרו/g, "pro"],
  [/מקס/g, "max"],
  [/(^|\s)אס\s*(\d)/g, "$1s$2"],
  [/\bs\s+(\d)/gi, "s$1"],
];

export function toHebrewModelName(english: string): string {
  let name = english;
  for (const [pattern, replacement] of EN_TO_HE) {
    name = name.replace(pattern, replacement);
  }
  return name.replace(/\s+/g, " ").trim();
}

/** Turns a Hebrew or mixed query into the English words the catalog is stored under. */
export function normalizeSearchQuery(query: string): string {
  let text = query.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of HE_TO_EN) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, " ").trim();
}

export function publicModelName(locale: PublicLocale, nameHe: string, nameEn: string): string {
  if (locale === "en") return nameEn;
  if (HEBREW.test(nameHe)) return nameHe;
  return toHebrewModelName(nameEn || nameHe);
}
