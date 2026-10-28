import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/server/supabase/read-client", () => ({
  getReadClient: () => ({ rpc }),
}));

const { getModel, getOffers, listModels, ReadModelError, searchModels } = await import("./catalog");

const offer = {
  offer_ref: "0123456789abcdef01234567",
  company_slug: "ksp",
  company_name_he: "KSP",
  company_name_en: "KSP",
  logo_url: null,
  price: 2500,
  payout_methods: [],
  payout_time_he: null,
  payout_time_en: null,
  delivery_methods: [],
  last_updated_at: "2026-10-21T07:15:53.397269+00:00",
  is_stale: false,
  company_grade_label: "כחדש לחלוטין",
  policy_summary_he: null,
  policy_summary_en: null,
  policy_url: null,
};

beforeEach(() => rpc.mockReset());

describe("getOffers", () => {
  it("passes validated, normalized arguments to the read model", async () => {
    rpc.mockResolvedValue({ data: [offer], error: null });
    const rows = await getOffers({ modelSlug: "iphone-15-pro", storageGb: "256", grade: "b" });
    expect(rpc).toHaveBeenCalledWith("offers_for", {
      p_model_slug: "iphone-15-pro",
      p_storage_gb: 256,
      p_grade: "B",
    });
    expect(rows).toHaveLength(1);
  });

  it("never calls the database for invalid input", async () => {
    for (const query of [
      { modelSlug: "../etc", storageGb: 256, grade: "A" },
      { modelSlug: "iphone-15", storageGb: "abc", grade: "A" },
      { modelSlug: "iphone-15", storageGb: 256, grade: "Z" },
    ]) {
      expect(await getOffers(query)).toEqual([]);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects responses that break the contract (e.g. a float price)", async () => {
    rpc.mockResolvedValue({ data: [{ ...offer, price: 10.5 }], error: null });
    await expect(getOffers({ modelSlug: "iphone-15", storageGb: 128, grade: "A" })).rejects.toBeInstanceOf(
      ReadModelError,
    );
  });

  it("surfaces database errors without leaking details", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for table x" } });
    await expect(getOffers({ modelSlug: "iphone-15", storageGb: 128, grade: "A" })).rejects.toThrow(
      "read model call failed: offers_for (42501)",
    );
  });
});

describe("other reads", () => {
  it("returns null for malformed model slugs without a query", async () => {
    expect(await getModel("Bad Slug")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("skips search for too-short queries", async () => {
    expect(await searchModels(" a ")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects unknown brands and out-of-range pages before querying", () => {
    expect(() => listModels("nokia")).toThrow();
    expect(() => listModels("apple", { limit: 500 })).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
