"use client";

import { GradeBadge } from "@/components/GradeBadge";
import type { SummaryResponse } from "@/lib/api";
import { sortCompanySlugs } from "@/lib/companyOrder";
import { tierColumnStyle, tierGroupHeaderStyle } from "@/lib/tierStyles";
import {
  formatPrice,
  highestPriceCellClass,
  highestPriceCellStyle,
  highestPriceKeys,
} from "@/lib/highestPriceHighlight";
import { useCompactTable } from "@/lib/useCompactTable";
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

interface FlatColumn {
  id: string;
  tier: number;
  tierLabel: string;
  slug: string;
  companyName: string;
  gradeLabel: string;
  color: string;
}

function buildFlatColumns(data: SummaryResponse): FlatColumn[] {
  const companyMap = Object.fromEntries(data.companies.map((c) => [c.slug, c]));
  const columns: FlatColumn[] = [];

  for (const tier of data.tier_config) {
    for (const slug of sortCompanySlugs(tier.companies)) {
      const co = companyMap[slug];
      const grade = co?.grades.find((g) => g.summary_tier === tier.tier);
      if (!grade) continue;
      columns.push({
        id: `${tier.tier}-${slug}`,
        tier: tier.tier,
        tierLabel: tier.label,
        slug,
        companyName: co?.name || slug,
        gradeLabel: grade.label,
        color: co?.color || "#666",
      });
    }
  }
  return columns;
}

function buildPriceMap(device: SummaryResponse["devices"][0]) {
  const map = new Map<string, number>();
  for (const tier of device.tiers) {
    for (const p of tier.prices) {
      map.set(`${tier.tier}-${p.company}`, p.price);
    }
  }
  return map;
}

function formatPriceCell(n: number | undefined) {
  return formatPrice(n);
}

function tierHighlightsForRow(
  columns: FlatColumn[],
  priceMap: Map<string, number>
): Set<string> {
  const byTier = new Map<number, FlatColumn[]>();
  for (const col of columns) {
    const list = byTier.get(col.tier) || [];
    list.push(col);
    byTier.set(col.tier, list);
  }

  const best = new Set<string>();
  byTier.forEach((tierCols) => {
    const keys = highestPriceKeys(
      tierCols.map((col) => ({ key: col.id, price: priceMap.get(col.id) }))
    );
    keys.forEach((id) => best.add(id));
  });
  return best;
}

function tierGroups(columns: FlatColumn[]) {
  const groups: Array<{ tier: number; label: string; columns: FlatColumn[] }> = [];
  for (const col of columns) {
    const last = groups[groups.length - 1];
    if (last && last.tier === col.tier) {
      last.columns.push(col);
    } else {
      groups.push({ tier: col.tier, label: col.tierLabel, columns: [col] });
    }
  }
  return groups;
}

function tierCellStyle(tier: number, tierStart: boolean, index: number) {
  return tierColumnStyle(tier, tierStart, index);
}

export function SummaryFlatView({ data }: Props) {
  const compact = useCompactTable();
  const columns = buildFlatColumns(data);
  const groups = tierGroups(columns);
  const deviceColW = compact ? 148 : 220;
  const colW = compact ? 96 : 120;
  const tableWidth = deviceColW + columns.length * colW;

  const visibleDevices = data.devices.filter((device) => {
    const prices = buildPriceMap(device);
    return columns.some((col) => prices.has(col.id));
  });

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card w-full min-w-0">
      <div className="px-3 sm:px-4 py-3 border-b border-surface-border bg-surface/50 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-white text-sm sm:text-base">Unified comparison</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            One row per device — scroll right for more tiers
          </p>
        </div>
      </div>
      <TableScroll className="rounded-b-xl w-full -mx-px">
        <table
          className="text-xs sm:text-sm border-separate border-spacing-0 table-fixed"
          style={{ width: tableWidth, minWidth: tableWidth }}
        >
          <colgroup>
            <col style={{ width: deviceColW }} />
            {columns.map((col) => (
              <col key={col.id} style={{ width: colW }} />
            ))}
          </colgroup>
          <thead className={`${stickyThead} bg-surface-card`}>
            <tr className="text-slate-300">
              <th
                rowSpan={3}
                className={`${stickyThDeviceLtr} px-2 sm:px-4 py-2 font-medium text-left align-middle h-[2.75rem] text-xs sm:text-sm`}
              >
                Device
              </th>
              {groups.map((group, gi) => (
                <th
                  key={`tier-label-${group.tier}`}
                  colSpan={group.columns.length}
                  className={`${headerTh} px-2 sm:px-3 py-2 text-center text-[10px] sm:text-xs font-semibold leading-snug align-middle h-[2.75rem] text-slate-200`}
                  style={tierGroupHeaderStyle(group.tier, gi)}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className="text-slate-300">
              {columns.map((col, i) => {
                const prev = columns[i - 1];
                const tierStart = !prev || prev.tier !== col.tier;
                return (
                  <th
                    key={`co-${col.id}`}
                    className={`${headerTh} px-1 sm:px-2 py-2 text-center font-medium align-middle h-11`}
                    style={tierCellStyle(col.tier, tierStart, i)}
                  >
                    <span className="inline-flex items-center justify-center gap-1 sm:gap-1.5 max-w-full">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="truncate text-[11px] sm:text-sm">{col.companyName}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr>
              {columns.map((col, i) => {
                const prev = columns[i - 1];
                const tierStart = !prev || prev.tier !== col.tier;
                return (
                  <th
                    key={`grade-${col.id}`}
                    className={`${headerTh} px-1 sm:px-2 py-1.5 text-center align-middle h-10 sm:h-11`}
                    style={tierCellStyle(col.tier, tierStart, i)}
                  >
                    <GradeBadge label={col.gradeLabel} accentColor={col.color} className="w-full" />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleDevices.map((device) => {
              const priceMap = buildPriceMap(device);
              const bestColumnIds = tierHighlightsForRow(columns, priceMap);
              return (
                <tr key={device.normalized_name} className="hover:bg-surface/30">
                  <td
                    className={`${stickyTdDeviceLtr} px-2 sm:px-4 py-2 font-medium text-white text-xs sm:text-sm truncate max-w-[45vw] sm:max-w-none border-b border-surface-border/50`}
                    title={device.normalized_name}
                  >
                    {device.normalized_name}
                  </td>
                  {columns.map((col, i) => {
                    const prev = columns[i - 1];
                    const tierStart = !prev || prev.tier !== col.tier;
                    const price = priceMap.get(col.id);
                    const isHighest = bestColumnIds.has(col.id);
                    const baseStyle = {
                      ...tierCellStyle(col.tier, tierStart, i),
                      ...(price != null && !isHighest
                        ? { backgroundColor: `${col.color}22` }
                        : {}),
                    };
                    return (
                      <td
                        key={col.id}
                        className={`px-1 sm:px-2 py-2 text-center tabular-nums text-xs sm:text-sm border-b border-surface-border/50 ${highestPriceCellClass(isHighest)}`}
                        style={highestPriceCellStyle(isHighest, col.tier, baseStyle)}
                      >
                        {formatPriceCell(price)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
