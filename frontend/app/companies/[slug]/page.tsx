"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CompanyPriceTable } from "@/components/CompanyPriceTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { DownloadExcelButton } from "@/components/ExcelActionButtons";
import { apiDownload, apiFetch, type CompanyPricesResponse } from "@/lib/api";

export default function CompanyPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [data, setData] = useState<CompanyPricesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (brand) q.set("brand", brand);
      q.set("limit", "500");
      const res = await apiFetch<CompanyPricesResponse>(
        `/api/companies/${slug}/prices?${q.toString()}`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, [slug, search, brand]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="min-w-0">
      <PageHeader
        title={data?.company.name || slug}
        subtitle={data ? `${data.total} devices` : "Loading..."}
        actions={
          <DownloadExcelButton
            className="w-full sm:w-auto"
            onClick={() => apiDownload(`/api/export/company/${slug}`, `${slug}.xlsx`)}
          />
        }
      />

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        brand={brand}
        onBrandChange={setBrand}
      />

      {loading && <p className="text-slate-400 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {data && !loading && <CompanyPriceTable data={data} />}
    </div>
  );
}
