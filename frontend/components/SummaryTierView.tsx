"use client";

import { GradeBadge } from "@/components/GradeBadge";
import type { SummaryResponse } from "@/lib/api";
import { sortCompanySlugs } from "@/lib/companyOrder";
import {
  formatPrice,
  highestPriceCellClass,
  highestPriceCellStyle,
  highestPriceKeys,
} from "@/lib/highestPriceHighlight";
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
                  const bestSlugs = highestPriceKeys(
                    orderedSlugs.map((slug) => ({ key: slug, price: priceMap[slug] }))
                  );
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
                        const isHighest = bestSlugs.has(slug);
                        const baseBg =
                          !isHighest && price != null && co?.color
                            ? { backgroundColor: `${co.color}12` }
                            : undefined;
                        return (
                          <td
                            key={slug}
                            className={`px-1 sm:px-2 py-2 text-center tabular-nums text-xs sm:text-sm border-b border-surface-border/50 align-middle ${highestPriceCellClass(isHighest)}`}
                            style={highestPriceCellStyle(isHighest, tier.tier, baseBg)}
                          >
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
