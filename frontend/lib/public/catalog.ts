import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeSearchQuery } from "./modelName";
import {
  brandSchema,
  companyRow,
  gradeRow,
  modelRow,
  modelSlugSchema,
  offerQuerySchema,
  offerRow,
  paginationSchema,
  policyRow,
  searchHit,
  searchQuerySchema,
  searchRow,
  brandRow,
  type Brand,
  type SearchHit,
} from "./schemas";

export const CATALOG_TAG = "catalog";
const REVALIDATE_SECONDS = 300;

export class ReadModelError extends Error {
  constructor(fn: string) {
    super(`read model call failed: ${fn}`);
    this.name = "ReadModelError";
  }
}

function getReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) {
    throw new ReadModelError("config");
  }
  return createClient(url, key, {
    db: { schema: "public_site" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let client: ReturnType<typeof getReadClient> | undefined;

function readClient() {
  client ??= getReadClient();
  return client;
}

async function callRpc<T extends z.ZodType>(
  fn: string,
  args: Record<string, unknown>,
  row: T,
): Promise<z.infer<T>[]> {
  const { data, error } = await readClient().rpc(fn, args);
  if (error) throw new ReadModelError(fn);
  const parsed = z.array(row).safeParse(data ?? []);
  if (!parsed.success) throw new ReadModelError(fn);
  return parsed.data;
}

function cached<A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>) {
  return unstable_cache(fn, ["read-model", key], {
    tags: [CATALOG_TAG],
    revalidate: REVALIDATE_SECONDS,
  });
}

const listBrandsCached = cached("list_brands", () => callRpc("list_brands", {}, brandRow));

const listModelsCached = cached("list_models", (brand: Brand, limit: number, offset: number) =>
  callRpc("list_models", { p_brand: brand, p_limit: limit, p_offset: offset }, modelRow),
);

const getModelCached = cached("get_model", async (slug: string) => {
  const rows = await callRpc("get_model", { p_model_slug: slug }, modelRow);
  return rows[0] ?? null;
});

const offersForCached = cached("offers_for", (slug: string, storageGb: number, grade: string) =>
  callRpc(
    "offers_for",
    { p_model_slug: slug, p_storage_gb: storageGb, p_grade: grade },
    offerRow,
  ),
);

const listGradesCached = cached("list_condition_grades", () =>
  callRpc("list_condition_grades", {}, gradeRow),
);

const listCompaniesCached = cached("list_companies", () =>
  callRpc("list_companies", {}, companyRow),
);

const listPoliciesCached = cached("list_condition_policies", () =>
  callRpc("list_condition_policies", {}, policyRow),
);

const searchModelsCached = cached("search_models", (query: string) =>
  callRpc("search_models", { p_query: query }, searchRow),
);

export function listBrands() {
  return listBrandsCached();
}

export function listModels(brand: string, page?: { limit?: number; offset?: number }) {
  const validBrand = brandSchema.parse(brand);
  const { limit, offset } = paginationSchema.parse(page ?? {});
  return listModelsCached(validBrand, limit, offset);
}

export async function getModel(slug: string) {
  const parsed = modelSlugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return getModelCached(parsed.data);
}

export async function getOffers(query: {
  modelSlug: unknown;
  storageGb: unknown;
  grade: unknown;
}) {
  const parsed = offerQuerySchema.safeParse(query);
  if (!parsed.success) return [];
  return offersForCached(parsed.data.modelSlug, parsed.data.storageGb, parsed.data.grade);
}

export function listConditionGrades() {
  return listGradesCached();
}

export function listCompanies() {
  return listCompaniesCached();
}

export function listConditionPolicies() {
  return listPoliciesCached();
}

export async function searchModels(query: string): Promise<SearchHit[]> {
  const parsed = searchQuerySchema.safeParse(normalizeSearchQuery(query));
  if (!parsed.success) return [];
  const rows = await searchModelsCached(parsed.data);
  return rows.map((row) => searchHit.parse(row));
}
