"use client";

import { GradeBadge } from "@/components/GradeBadge";
import type { SummaryResponse } from "@/lib/api";
import { sortCompanySlugs } from "@/lib/companyOrder";
import {
  TableScroll,
  headerTh,
  stickyTdDeviceLtr,
  stickyThead,
  stickyThDeviceLtr,
} from "@/components/TableScroll";

interface Props {
  data: SummaryResponse;
}

function formatPrice(n: number | undefined) {
  if (n == null) return "—";
  return `₪${n.toLocaleString("he-IL")}`;
}

function maxPriceInRow(priceMap: Record<string, number | undefined>, slugs: string[]): number | null {
  const values = slugs.map((s) => priceMap[s]).filter((p): p is number => p != null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function highestPriceCellClass(isHighest: boolean): string {
  if (!isHighest) return "";
  return [
    "relative z-[1] font-semibold text-emerald-200",
    "bg-gradient-to-b from-emerald-500/20 to-emerald-600/10",
    "ring-1 ring-inset ring-emerald-400/50",
    "shadow-[0_0_14px_rgba(52,211,153,0.12)]",
    "rounded-md",
  ].join(" ");
}

export function SummaryTierView({ data }: Props) {
  const companyMap = Object.fromEntries(data.companies.map((c) => [c.slug, c]));

  return (
    <div className="space-y-4 sm:space-y-6">
      {data.tier_config.map((tier) => (
        <section
          key={tier.tier}
          className="rounded-xl border border-surface-border bg-surface-card min-w-0"
        >
          <div className="px-3 sm:px-4 py-3 border-b border-surface-border bg-surface/50">
            <h2 className="font-semibold text-white text-sm sm:text-base">{tier.label}</h2>
            <p className="text-xs text-slate-500 mt-0.5 break-words">
              {sortCompanySlugs(tier.companies)
                .map((s) => companyMap[s]?.name || s)
                .join(" · ")}
            </p>
          </div>
          <TableScroll className="rounded-b-xl w-full -mx-px">
            <table className="text-xs sm:text-sm min-w-max border-separate border-spacing-0">
              <thead className={stickyThead}>
                <tr className="text-slate-300">
                  <th
                    className={`${stickyThDeviceLtr} text-left px-2 sm:px-4 py-2 font-medium min-w-[140px] sm:min-w-[220px] align-middle text-xs sm:text-sm`}
                  >
                    Device
                  </th>
                  {sortCompanySlugs(tier.companies).map((slug) => {
                    const co = companyMap[slug];
                    const grade = co?.grades.find((g) => g.summary_tier === tier.tier);
                    const color = co?.color || "#666";
                    return (
                      <th
                        key={slug}
                        className={`${headerTh} text-center px-2 sm:px-3 py-2 font-medium min-w-[96px] sm:min-w-[130px] align-middle`}
                      >
                        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[11px] sm:text-sm">{co?.name}</span>
                          </span>
                          {grade && (
                            <GradeBadge label={grade.label} accentColor={color} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device) => {
                  const tierData = device.tiers.find((t) => t.tier === tier.tier);
                  const orderedSlugs = sortCompanySlugs(tier.companies);
                  const priceMap = Object.fromEntries(
                    (tierData?.prices || []).map((p) => [p.company, p.price])
                  );
                  const hasAny = orderedSlugs.some((s) => priceMap[s] != null);
                  if (!hasAny) return null;
                  const rowMax = maxPriceInRow(priceMap, orderedSlugs);
                  return (
                    <tr
                      key={`${device.normalized_name}-${tier.tier}`}
                      className="hover:bg-surface/30"
                    >
                      <td
                        className={`${stickyTdDeviceLtr} px-2 sm:px-4 py-2 font-medium text-white text-xs sm:text-sm truncate max-w-[45vw] sm:max-w-none border-b border-surface-border/50`}
                        title={device.normalized_name}
                      >
                        {device.normalized_name}
                      </td>
                      {orderedSlugs.map((slug) => {
                        const co = companyMap[slug];
                        const price = priceMap[slug];
                        const isHighest =
                          price != null && rowMax != null && price === rowMax;
                        return (
                          <td
                            key={slug}
                            className={`px-2 sm:px-3 py-2 text-center tabular-nums border-b border-surface-border/50 ${highestPriceCellClass(isHighest)}`}
                            style={
                              !isHighest && price != null && co?.color
                                ? { backgroundColor: `${co.color}12` }
                                : undefined
                            }
                          >
                            {isHighest && (
                              <span
                                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-emerald-400/90"
                                aria-hidden
                              >
                                best
                              </span>
                            )}
                            {formatPrice(price)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </section>
      ))}
    </div>
  );
}
