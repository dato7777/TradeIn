import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError("Not authenticated", 401);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(String(detail), res.status);
  }
  return res.json() as Promise<T>;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Not authenticated", 401);

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError("Download failed", res.status);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Not authenticated", 401);

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail ? String(body.detail) : "Upload failed", res.status);
  }
  return res.json();
}

// Types
export interface GradeColumn {
  key: string;
  label: string;
  summary_tier?: number;
}

export interface Company {
  slug: string;
  name: string;
  source_type: string;
  grades: GradeColumn[];
  color?: string;
  device_count: number;
  price_updated_at?: string | null;
}

export interface CompanyPricesResponse {
  company: {
    slug: string;
    name: string;
    grades: GradeColumn[];
    color?: string;
    price_updated_at?: string | null;
  };
  total: number;
  devices: Array<{
    normalized_name: string;
    brand: string;
    model: string;
    storage_gb: string;
    grades: Record<string, number>;
  }>;
}

export interface SummaryPrice {
  company: string;
  company_name: string;
  grade_key: string;
  grade_label: string;
  price: number;
  color?: string;
}

export interface SummaryResponse {
  tier_config: Array<{ tier: number; label: string; companies: string[] }>;
  companies: Company[];
  devices: Array<{
    normalized_name: string;
    brand: string;
    model: string;
    storage_gb: string;
    tiers: Array<{ tier: number; prices: SummaryPrice[] }>;
  }>;
}

export interface UserMe {
  user_id: string;
  email: string;
  role: "admin" | "viewer";
}

export interface ScrapeJob {
  id: string;
  status: string;
  progress_current: number;
  progress_total: number;
  error_message?: string;
}
