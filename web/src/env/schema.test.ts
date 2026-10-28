import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "./schema";

const base = {
  NEXT_PUBLIC_SITE_URL: "https://example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("parseServerEnv", () => {
  it("accepts the minimal Phase 2 configuration", () => {
    expect(parseServerEnv(base).NEXT_PUBLIC_SUPABASE_URL).toBe("https://proj.supabase.co");
  });

  it("fails fast when required values are missing", () => {
    expect(() => parseServerEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => parseServerEnv({ NEXT_PUBLIC_SITE_URL: base.NEXT_PUBLIC_SITE_URL })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("treats empty strings as unset", () => {
    const env = parseServerEnv({ ...base, SUPABASE_SECRET_KEY: "" });
    expect(env.SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it("rejects legacy-style or malformed Supabase keys", () => {
    expect(() =>
      parseServerEnv({ ...base, SUPABASE_SECRET_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy" }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() =>
      parseServerEnv({ ...base, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "eyJ.anon" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("rejects short HMAC secrets", () => {
    expect(() => parseServerEnv({ ...base, CLICK_HASH_SECRET: "short" })).toThrow(
      /CLICK_HASH_SECRET/,
    );
  });

  it("never exposes server secrets through the client schema", () => {
    const env = parseClientEnv({ ...base, SUPABASE_SECRET_KEY: "sb_secret_x" });
    expect(env).not.toHaveProperty("SUPABASE_SECRET_KEY");
  });
});
