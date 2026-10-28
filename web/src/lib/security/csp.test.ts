import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")] as const;
    }),
  );
}

describe("generateNonce", () => {
  it("returns a fresh base64 value of 128 bits", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});

describe("buildCsp (production)", () => {
  const csp = directives(
    buildCsp({ nonce: "abc123", isDev: false, supabaseUrl: "https://proj.supabase.co/rest" }),
  );

  it("allows scripts only via nonce and strict-dynamic", () => {
    const scriptSrc = csp.get("script-src") ?? "";
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("uses a nonce for style elements in production", () => {
    expect(csp.get("style-src")).toBe("'self' 'nonce-abc123'");
  });

  it("blocks framing, plugins and base tag hijacking", () => {
    expect(csp.get("frame-ancestors")).toBe("'none'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("base-uri")).toBe("'self'");
    expect(csp.get("form-action")).toBe("'self'");
  });

  it("allows only the Supabase origin for connections", () => {
    expect(csp.get("connect-src")).toBe("'self' https://proj.supabase.co");
  });

  it("upgrades insecure requests", () => {
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });
});

describe("buildCsp (development)", () => {
  it("adds unsafe-eval only in development", () => {
    const csp = directives(buildCsp({ nonce: "n", isDev: true }));
    expect(csp.get("script-src")).toContain("'unsafe-eval'");
    expect(csp.has("upgrade-insecure-requests")).toBe(false);
  });

  it("ignores an invalid Supabase URL", () => {
    const csp = directives(buildCsp({ nonce: "n", isDev: true, supabaseUrl: "not a url" }));
    expect(csp.get("connect-src")).toBe("'self'");
  });
});
