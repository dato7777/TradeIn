/** Display order for company columns in summary views (matches reference spreadsheet). */
export const COMPANY_COLUMN_ORDER = ["ksp", "partner", "dynamica", "pelephone"] as const;

export const COMPANY_COLORS: Record<string, string> = {
  dynamica: "#fce4ec",
  partner: "#e3f2fd",
  ksp: "#fff9c4",
  pelephone: "#e8f5e9",
};

export function companyColor(slug: string): string {
  return COMPANY_COLORS[slug] || "#94a3b8";
}

export function sortCompanySlugs(slugs: string[]): string[] {
  return [...slugs].sort(
    (a, b) =>
      (COMPANY_COLUMN_ORDER.indexOf(a as (typeof COMPANY_COLUMN_ORDER)[number]) === -1
        ? 99
        : COMPANY_COLUMN_ORDER.indexOf(a as (typeof COMPANY_COLUMN_ORDER)[number])) -
      (COMPANY_COLUMN_ORDER.indexOf(b as (typeof COMPANY_COLUMN_ORDER)[number]) === -1
        ? 99
        : COMPANY_COLUMN_ORDER.indexOf(b as (typeof COMPANY_COLUMN_ORDER)[number]))
  );
}
