import { formatPriceUpdatedAt } from "@/lib/formatPriceUpdated";

interface Props {
  updatedAt?: string | null;
  className?: string;
}

/** Single company — centered label for page header toolbar. */
export function PriceUpdatedAt({ updatedAt, className = "" }: Props) {
  const formatted = formatPriceUpdatedAt(updatedAt);
  return (
    <div
      className={`text-center text-xs sm:text-sm text-slate-300 px-2 ${className}`}
      dir="rtl"
    >
      {formatted ? (
        <>
          <span className="text-slate-500">עודכון מחירים: </span>
          <span className="font-medium text-slate-200">{formatted}</span>
        </>
      ) : (
        <span className="text-slate-500">טרם עודכנו מחירים</span>
      )}
    </div>
  );
}

export interface CompanyUpdateInfo {
  slug: string;
  name: string;
  color?: string;
  price_updated_at?: string | null;
}

/** Colorful list of per-company update times (unified summary header). */
export function CompanyPriceUpdatesList({ companies }: { companies: CompanyUpdateInfo[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-end gap-2" dir="rtl">
      {companies.map((co) => {
        const formatted = formatPriceUpdatedAt(co.price_updated_at);
        const accent = co.color || "#64748b";
        return (
          <li
            key={co.slug}
            className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm shadow-sm"
            style={{
              borderColor: `${accent}66`,
              backgroundColor: `${accent}18`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20"
              style={{ backgroundColor: accent }}
            />
            <span className="font-semibold text-white">{co.name}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-200 tabular-nums">
              {formatted || "לא עודכן"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
