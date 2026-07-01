import { formatPriceUpdatedAt } from "@/lib/formatPriceUpdated";
import { companyColor } from "@/lib/companyOrder";

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

function ClockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/** Toggle button for summary toolbar — shows/hides CompanyPriceUpdatesPanel. */
export function PriceUpdatesToggleButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="company-price-updates-panel"
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
        "border shadow-sm",
        open
          ? "bg-sky-500/20 border-sky-400/50 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.15)]"
          : "bg-surface-card border-surface-border text-slate-200 hover:border-sky-400/40 hover:text-white hover:bg-surface/80",
      ].join(" ")}
      dir="rtl"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border ${
          open
            ? "bg-sky-500/25 border-sky-400/40 text-sky-200"
            : "bg-surface border-surface-border text-slate-400"
        }`}
      >
        <ClockIcon className="h-4 w-4" />
      </span>
      <span>מתי עודכנו המחירים</span>
    </button>
  );
}

/** Standalone panel — vertical list of per-company update times (summary unified view). */
export function CompanyPriceUpdatesPanel({ companies }: { companies: CompanyUpdateInfo[] }) {
  return (
    <section
      id="company-price-updates-panel"
      className="mx-auto w-full max-w-md sm:max-w-lg mb-4 sm:mb-5"
      dir="rtl"
      aria-label="תאריכי עדכון מחירים"
    >
      <div className="rounded-xl border border-surface-border bg-gradient-to-b from-surface-card to-surface/80 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border bg-surface/60 text-center">
          <div className="inline-flex items-center justify-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300">
              <ClockIcon />
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
              עדכון מחירים לפי חברה
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            תאריך עדכון אחרון  
          </p>
        </div>

        <ul className="divide-y divide-surface-border/60 px-2 py-2 sm:px-3">
          {companies.map((co) => {
            const formatted = formatPriceUpdatedAt(co.price_updated_at);
            const accent = co.color || companyColor(co.slug);
            const hasDate = Boolean(formatted);

            return (
              <li key={co.slug} className="group">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 sm:py-3 transition-colors hover:bg-white/[0.03]">
                  <span
                    className="w-1 self-stretch min-h-[2.5rem] rounded-full shrink-0 shadow-sm"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `0 0 12px ${accent}55`,
                    }}
                    aria-hidden
                  />
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold text-white shadow-inner"
                    style={{
                      borderColor: `${accent}55`,
                      backgroundColor: `${accent}28`,
                    }}
                  >
                    {co.name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-semibold text-white text-sm truncate">{co.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {hasDate ? "מחירים עודכנו" : "אין נתונים"}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 text-left rounded-md px-2.5 py-1.5 text-xs sm:text-sm tabular-nums border ${
                      hasDate
                        ? "text-slate-100 border-white/10 bg-white/5"
                        : "text-slate-500 border-surface-border bg-surface/40 italic"
                    }`}
                  >
                    {formatted || "לא עודכן"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** @deprecated Use CompanyPriceUpdatesPanel */
export function CompanyPriceUpdatesList({ companies }: { companies: CompanyUpdateInfo[] }) {
  return <CompanyPriceUpdatesPanel companies={companies} />;
}
