import { describe, expect, it } from "vitest";
import { hashEmail, normalizeEmail } from "@/lib/alerts/email";
import { evaluateAlert } from "@/lib/alerts/evaluate";
import { publicAlertUrl } from "@/lib/alerts/links";
import { signToken, verifyToken } from "@/lib/alerts/tokens";
import { turnstileOk } from "@/lib/alerts/turnstile";

const secret = "s".repeat(40);
const previous = "p".repeat(40);
const id = "11111111-1111-4111-8111-111111111111";

describe("normalizeEmail", () => {
  it("lowercases, trims, and keeps plus-tags and dots", () => {
    expect(normalizeEmail("  A.B+Tag@Example.com ")).toBe("a.b+tag@example.com");
  });

  it("punycodes an internationalized domain", () => {
    expect(normalizeEmail("user@münchen.test")).toBe("user@xn--mnchen-3ya.test");
  });

  it("rejects newlines, spaces, unicode local parts, and over-length addresses", () => {
    expect(normalizeEmail("a@b.com\nBcc: x")).toBeNull();
    expect(normalizeEmail("a b@c.com")).toBeNull();
    expect(normalizeEmail("ü@example.com")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@b.com`)).toBeNull();
  });
});

describe("hashEmail", () => {
  it("is a stable 64-character hex hmac", () => {
    const hash = hashEmail("a@b.com", secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashEmail("a@b.com", secret));
    expect(hash).not.toBe(hashEmail("a@b.com", previous));
  });
});

describe("tokens", () => {
  const now = 1_700_000_000;

  it("round-trips a confirm token and rejects tampering, the wrong purpose, and expiry", () => {
    const token = signToken({ purpose: "confirm", id, exp: now + 60, secret });
    expect(verifyToken(token, "confirm", { current: secret }, now)?.id).toBe(id);
    expect(verifyToken(token, "manage", { current: secret }, now)).toBeNull();
    expect(verifyToken(token, "confirm", { current: secret }, now + 61)).toBeNull();
    const [left, exp, mac] = token.split(".");
    expect(verifyToken(`${left}.${exp}.${mac!.slice(0, -1)}x`, "confirm", { current: secret }, now)).toBeNull();
  });

  it("accepts a rotated secret and a manage token that does not expire", () => {
    const old = signToken({ purpose: "manage", id, secret: previous });
    expect(verifyToken(old, "manage", { current: secret, previous }, now + 10_000_000)?.id).toBe(id);
    expect(old.endsWith(".0.") || old.includes(".0.")).toBe(true);
  });
});

describe("evaluateAlert", () => {
  const cfg = { minChangeIls: 30, minChangePercent: 3, cooldownHours: 24 };
  const now = new Date("2026-10-30T00:00:00Z");

  function at(baseline: number | null, current: number | null, lastAlertAt: Date | null = null) {
    return evaluateAlert({ baseline, current, lastAlertAt, now, cfg });
  }

  it("covers the threshold table", () => {
    expect(at(null, null).send).toBe(false);
    expect(at(1000, null)).toMatchObject({ send: false, reason: "no_current" });
    expect(at(null, 1500)).toMatchObject({ send: true, kind: "available", current: 1500 });
    expect(at(1000, 1030)).toMatchObject({ send: true, kind: "up", deltaIls: 30 });
    expect(at(1000, 970)).toMatchObject({ send: true, kind: "down", deltaIls: -30 });
    expect(at(1000, 1029)).toMatchObject({ send: false, reason: "below_threshold" });
    expect(at(10000, 10300)).toMatchObject({ send: true, kind: "up" });
    expect(at(10000, 10299)).toMatchObject({ send: false, reason: "below_threshold" });
    expect(at(200, 230)).toMatchObject({ send: true, kind: "up" });
    expect(at(200, 220)).toMatchObject({ send: false, reason: "below_threshold" });
    expect(at(1000, 2000, new Date(now.getTime() - 60 * 60 * 1000))).toMatchObject({
      send: false,
      reason: "cooldown",
    });
    expect(at(1000, 1000, new Date(now.getTime() - 60 * 60 * 1000))).toMatchObject({
      send: false,
      reason: "cooldown",
    });
    expect(at(1000, 1030, new Date(now.getTime() - 24 * 60 * 60 * 1000)).send).toBe(true);
  });
});

describe("links", () => {
  it("prefixes English, stays on the site, and carries no email", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    const url = publicAlertUrl("/en/sell/apple/iphone-13", {
      storage: "128",
      condition: "A",
      utm_source: "price-alert",
      utm_medium: "email",
      utm_campaign: "alert",
    });
    expect(url.startsWith("https://example.com/en/sell/apple/iphone-13?")).toBe(true);
    expect(url.includes("@")).toBe(false);
    expect(url).not.toContain("/go/");
    expect(() => publicAlertUrl("//evil.example")).toThrow();
    expect(() => publicAlertUrl("/en/sell/apple/iphone-13", { storage: "a@b.com" })).toThrow();
  });
});

describe("turnstile", () => {
  const expected = { hostnames: ["example.com"], action: "price-alert" };

  it("accepts the matching host and action", () => {
    expect(turnstileOk({ success: true, hostname: "example.com", action: "price-alert" }, expected)).toBe(true);
  });

  it("rejects the wrong host, the wrong action, and a failed challenge", () => {
    expect(turnstileOk({ success: true, hostname: "evil.example", action: "price-alert" }, expected)).toBe(false);
    expect(turnstileOk({ success: true, hostname: "example.com", action: "other" }, expected)).toBe(false);
    expect(turnstileOk({ success: false, hostname: "example.com", action: "price-alert" }, expected)).toBe(false);
  });
});
