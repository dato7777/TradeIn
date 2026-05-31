"use client";

import { GradeBadge } from "@/components/GradeBadge";
import type { CompanyPricesResponse } from "@/lib/api";
import { companyColor } from "@/lib/companyOrder";
import {
  TableScroll,
  headerTh,
  stickyTdDeviceLtr,
  stickyThead,
  stickyThDeviceLtr,
} from "@/components/TableScroll";

interface Props {
  data: CompanyPricesResponse;
}

function formatPrice(n: number | undefined) {
  if (n == null) return "—";
  return `₪${n.toLocaleString("he-IL")}`;
}

export function CompanyPriceTable({ data }: Props) {
  const grades = data.company.grades;
  const accent = companyColor(data.company.slug);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card w-full min-w-0">
      <TableScroll className="rounded-xl w-full -mx-px">
        <table className="text-xs sm:text-sm min-w-max border-separate border-spacing-0">
          <thead className={stickyThead}>
            <tr className="text-slate-300">
              <th
                className={`${stickyThDeviceLtr} text-left px-2 sm:px-4 py-3 font-medium min-w-[140px] sm:min-w-[220px] align-middle text-xs sm:text-sm`}
              >
                Device
              </th>
              {grades.map((g) => (
                <th
                  key={g.key}
                  className={`${headerTh} text-center px-2 sm:px-3 py-2 sm:py-3 font-medium min-w-[88px] sm:min-w-[110px] align-middle`}
                >
                  <GradeBadge label={g.label} accentColor={accent} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.devices.map((device) => (
              <tr key={device.normalized_name} className="hover:bg-surface/30">
                <td
                  className={`${stickyTdDeviceLtr} px-2 sm:px-4 py-2 font-medium text-white text-xs sm:text-sm truncate max-w-[45vw] sm:max-w-none border-b border-surface-border/50`}
                  title={device.normalized_name}
                >
                  {device.normalized_name}
                </td>
                {grades.map((g) => (
                  <td
                    key={g.key}
                    className="px-2 sm:px-3 py-2 text-center tabular-nums border-b border-surface-border/50"
                  >
                    {formatPrice(device.grades[g.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {data.devices.length === 0 && (
        <p className="text-center text-slate-500 py-12 text-sm">No devices found.</p>
      )}
    </div>
  );
}
