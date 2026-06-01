"use client";

import { useCallback, useEffect, useState } from "react";
import { ExcelActionButtons } from "@/components/ExcelActionButtons";
import { PageHeader } from "@/components/PageHeader";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { SummaryFlatView } from "@/components/SummaryFlatView";
import { SummaryTierView } from "@/components/SummaryTierView";
import { apiDownload, apiFetch, type SummaryResponse, type UserMe } from "@/lib/api";

type SummaryViewMode = "tier" | "flat";

export default function SummaryPage() {
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [view, setView] = useState<SummaryViewMode>("flat");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (brand) params.set("brand", brand);
      const qs = params.toString();
      const res = await apiFetch<SummaryResponse>(`/api/summary${qs ? `?${qs}` : ""}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [search, brand]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    apiFetch<UserMe>("/api/auth/me")
      .then((u) => setIsAdmin(u.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="min-w-0">
      <PageHeader
        title="סיכום השוואת מחירי טרייד-אין"
        rtl
        titleClassName="text-transparent bg-clip-text bg-gradient-to-l from-sky-200 via-white to-blue-100 drop-shadow-sm tracking-tight"
        subtitle={
          view === "flat"
            ? "All grade prices for each device in one row"
            : "Prices grouped by condition tier across all companies"
        }
        actions={
          <>
            <div className="inline-flex w-full sm:w-auto rounded-lg border border-surface-border bg-surface-card p-1 text-sm">
              <button
                type="button"
                onClick={() => setView("flat")}
                className={`flex-1 sm:flex-none rounded-md px-3 py-1.5 transition-colors ${
                  view === "flat"
                    ? "bg-accent text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Unified row
              </button>
              <button
                type="button"
                onClick={() => setView("tier")}
                className={`flex-1 sm:flex-none rounded-md px-3 py-1.5 transition-colors ${
                  view === "tier"
                    ? "bg-accent text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                By tier
              </button>
            </div>
            <ExcelActionButtons
              showUpload={isAdmin}
              onDownload={() => apiDownload("/api/export/summary", "summary.xlsx")}
            />
          </>
        }
      />

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        brand={brand}
        onBrandChange={setBrand}
      />

      {loading && <p className="text-slate-400 text-sm">טוען נתונים ...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {data && !loading && data.devices.length === 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-card p-6 sm:p-8 text-center">
          <p className="text-slate-300 font-medium">No price data yet</p>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            Upload Dynamica or Partner Excel, or run Extract Data from the admin menu to populate
            prices.
          </p>
        </div>
      )}
      {data && !loading && data.devices.length > 0 && (
        view === "flat" ? <SummaryFlatView data={data} /> : <SummaryTierView data={data} />
      )}
    </div>
  );
}
