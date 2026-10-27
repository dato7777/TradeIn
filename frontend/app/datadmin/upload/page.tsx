"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch, apiUpload } from "@/lib/api";

const UPLOAD_COMPANIES = [
  { slug: "dynamica", name: "Dynamica", note: "Model column: דגם / Model / Device. Grades: A/B/C/D (also תקין A, שבור/סדוק C, etc.)" },
  { slug: "partner", name: "Partner", note: "Columns: דגם, תקין" },
];

export default function AdminUploadPage() {
  const [slug, setSlug] = useState("dynamica");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiUpload<Record<string, unknown>>(
        `/api/import/${slug}/preview`,
        file
      );
      setPreview(res);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiUpload<{ imported: number; errors: string[] }>(
        `/api/import/${slug}`,
        file
      );
      setMessage(`Imported ${res.imported} rows.${res.errors?.length ? ` Warnings: ${res.errors.length}` : ""}`);
      setPreview(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const selected = UPLOAD_COMPANIES.find((c) => c.slug === slug);

  return (
    <div className="w-full max-w-2xl min-w-0">
      <PageHeader
        title="Excel Upload"
        subtitle="Upload Dynamica or Partner price spreadsheets"
      />

      <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Company</label>
          <select
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setPreview(null);
            }}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 sm:px-4 py-2 text-sm"
          >
            {UPLOAD_COMPANIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {selected && <p className="text-xs text-slate-500 mt-1">{selected.note}</p>}
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Excel file (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
            }}
            className="w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-surface-border file:px-3 file:py-1.5 file:text-sm file:text-slate-200"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="w-full sm:w-auto rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-surface-border disabled:opacity-50"
          >
            Preview
          </button>
          <button
            onClick={handleCommit}
            disabled={!file || loading}
            className="w-full sm:w-auto rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Import
          </button>
        </div>

        {message && <p className="text-sm text-amber-300 break-words">{message}</p>}

        {preview && (
          <pre className="text-xs bg-surface rounded-lg p-3 sm:p-4 overflow-auto max-h-64 text-slate-300">
            {JSON.stringify(preview, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
