import { describe, expect, it } from "vitest";
import { gradeSchema, modelSlugSchema, offerQuerySchema, searchQuerySchema, storageGbSchema } from "./params";

describe("catalog params", () => {
  it("accepts valid model slugs and rejects injection attempts", () => {
    expect(modelSlugSchema.safeParse("iphone-15-pro-max").success).toBe(true);
    for (const bad of ["", "iPhone-15", "iphone--15", "-iphone", "iphone_15", "x'; drop table", "a".repeat(81)]) {
      expect(modelSlugSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("normalizes grade case and rejects unknown grades", () => {
    expect(gradeSchema.parse(" b ")).toBe("B");
    expect(gradeSchema.safeParse("E").success).toBe(false);
  });

  it("coerces storage from query strings within bounds", () => {
    expect(storageGbSchema.parse("256")).toBe(256);
    for (const bad of ["0", "-1", "1.5", "99999", "abc"]) {
      expect(storageGbSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("collapses whitespace in search and enforces 2–64 characters", () => {
    expect(searchQuerySchema.parse("  iphone   15 ")).toBe("iphone 15");
    expect(searchQuerySchema.safeParse(" a ").success).toBe(false);
    expect(searchQuerySchema.safeParse("x".repeat(65)).success).toBe(false);
  });

  it("validates a full offer query", () => {
    expect(offerQuerySchema.parse({ modelSlug: "galaxy-s24-ultra", storageGb: "512", grade: "a" })).toEqual({
      modelSlug: "galaxy-s24-ultra",
      storageGb: 512,
      grade: "A",
    });
  });
});
