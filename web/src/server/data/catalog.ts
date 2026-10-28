import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  brandSchema,
  modelSlugSchema,
  offerQuerySchema,
  paginationSchema,
  searchQuerySchema,
  type Brand,
  type OfferQuery,
} from "@/lib/catalog/params";
import type { PublicSiteFunction, PublicSiteFunctions } from "@/server/supabase/database.types";
import { getReadClient } from "@/server/supabase/read-client";
import {
  brandRow,
  companyRow,
  gradeRow,
  modelRow,
  offerRow,
  policyRow,
  searchRow,
} from "./rows";

// Every catalog read is cached under this tag; /api/revalidate (Phase 6) clears it
// after a scrape. The time-based backstop keeps freshness flags current.
export const CATALOG_TAG = "catalog";
const REVALIDATE_SECONDS = 300;

export class ReadModelError extends Error {
  constructor(fn: string, code?: string) {
    super(`read model call failed: ${fn}${code ? ` (${code})` : ""}`);
    this.name = "ReadModelError";
  }
}

async function callRpc<F extends PublicSiteFunction, T extends z.ZodType>(
  fn: F,
  args: PublicSiteFunctions[F]["Args"],
  row: T,
): Promise<z.infer<T>[]> {
  const { data, error } = await getReadClient().rpc(fn, args);
  if (error) throw new ReadModelError(fn, error.code);
  const parsed = z.array(row).safeParse(data ?? []);
  if (!parsed.success) throw new ReadModelError(fn, "invalid_response");
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
  callRpc("offers_for", { p_model_slug: slug, p_storage_gb: storageGb, p_grade: grade }, offerRow),
);

const listGradesCached = cached("list_condition_grades", () =>
  callRpc("list_condition_grades", {}, gradeRow),
);

const listCompaniesCached = cached("list_companies", () => callRpc("list_companies", {}, companyRow));

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

/** Returns null for unknown or malformed slugs so pages can render a 404. */
export async function getModel(slug: string) {
  const parsed = modelSlugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return getModelCached(parsed.data);
}

/** Returns an empty list for invalid selections; never trusts client input. */
export async function getOffers(query: { modelSlug: unknown; storageGb: unknown; grade: unknown }) {
  const parsed = offerQuerySchema.safeParse(query);
  if (!parsed.success) return [];
  const { modelSlug, storageGb, grade }: OfferQuery = parsed.data;
  return offersForCached(modelSlug, storageGb, grade);
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

export async function searchModels(query: string) {
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) return [];
  return searchModelsCached(parsed.data);
}
