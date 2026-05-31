"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch, type ScrapeJob } from "@/lib/api";

const SCRAPER_COMPANIES = [
  { slug: "ksp", name: "KSP", note: "Bulk JSON API — fast" },
  { slug: "pelephone", name: "Pelephone", note: "HTTP TradeSearch API — fast" },
];

export default function AdminScrapePage() {
  const [jobs, setJobs] = useState<Record<string, ScrapeJob>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollJob(slug: string, jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await apiFetch<ScrapeJob>(`/api/scrape/jobs/${jobId}`);
        setJobs((prev) => ({ ...prev, [slug]: job }));
        if (job.status === "completed" || job.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setLoading(null);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setLoading(null);
      }
    }, 2000);
  }

  async function startScrape(slug: string) {
    setLoading(slug);
    setError("");
    try {
      const job = await apiFetch<ScrapeJob>(`/api/scrape/${slug}`, { method: "POST" });
      setJobs((prev) => ({ ...prev, [slug]: job }));
      pollJob(slug, job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start scrape");
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-2xl min-w-0">
      <PageHeader
        title="Extract Data"
        subtitle="Refresh KSP and Pelephone prices from their websites"
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {SCRAPER_COMPANIES.map((co) => {
          const job = jobs[co.slug];
          return (
            <div
              key={co.slug}
              className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4"
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{co.name}</h2>
                <p className="text-xs text-slate-500">{co.note}</p>
                {job && (
                  <div className="mt-2 text-sm">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${
                        job.status === "completed"
                          ? "bg-green-900/40 text-green-300"
                          : job.status === "failed"
                            ? "bg-red-900/40 text-red-300"
                            : "bg-blue-900/40 text-blue-300"
                      }`}
                    >
                      {job.status}
                    </span>
                    {job.progress_total > 0 && (
                      <span className="ml-2 text-slate-400">
                        {job.progress_current} / {job.progress_total}
                      </span>
                    )}
                    {job.error_message && (
                      <p className="text-red-400 text-xs mt-1 break-words">{job.error_message}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => startScrape(co.slug)}
                disabled={loading === co.slug}
                className="w-full sm:w-auto shrink-0 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading === co.slug ? "Running..." : "Start scrape"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
