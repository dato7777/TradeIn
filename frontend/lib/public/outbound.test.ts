import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { allowClick, clientIp } from "./rateLimit.ts";
import {
  buildTrackedUrl,
  hashIpUa,
  isNonClick,
  localeFromPath,
  OutboundUrlError,
  safeReferrerPath,
  uuidv7,
} from "./outbound.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const clickId = "018f3e6a-7b2c-7d4e-8f01-23456789abcd";

function input(overrides: Record<string, unknown> = {}) {
  return {
    destination: "https://alpha.example/trade?keep=1",
    allowedHosts: ["alpha.example"],
    trackingMode: "affiliate_params" as const,
    clickIdParam: "subid",
    staticParams: { aff_id: "abc" },
    utmSource: "resparts",
    brand: "apple" as const,
    modelSlug: "iphone-15-pro",
    storageGb: 256,
    grade: "A" as const,
    clickId,
    ...overrides,
  };
}

test("tracked url keeps the partner query and adds attribution", () => {
  const link = buildTrackedUrl(input());
  const url = new URL(link.href);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "alpha.example");
  assert.equal(url.searchParams.get("keep"), "1");
  assert.equal(url.searchParams.get("utm_source"), "resparts");
  assert.equal(url.searchParams.get("utm_medium"), "comparison");
  assert.equal(url.searchParams.get("utm_campaign"), "tradein-apple");
  assert.equal(url.searchParams.get("utm_content"), "iphone-15-pro_256_A");
  assert.equal(url.searchParams.get("subid"), clickId);
  assert.equal(url.searchParams.get("aff_id"), "abc");
  assert.equal(link.params.keep, undefined);
  assert.equal(link.params.aff_id, "abc");
  assert.equal(link.params.subid, clickId);
  assert.equal(link.href.includes("@"), false);
});

test("utm_only does not copy static affiliate params", () => {
  const link = buildTrackedUrl(input({ trackingMode: "utm_only", clickIdParam: null }));
  const url = new URL(link.href);
  assert.equal(url.searchParams.get("aff_id"), null);
  assert.equal(url.searchParams.get("click_id"), clickId);
  assert.equal(link.params.aff_id, undefined);
});

test("s2s still carries the click id and static params", () => {
  const link = buildTrackedUrl(input({ trackingMode: "s2s" }));
  assert.equal(new URL(link.href).searchParams.get("subid"), clickId);
  assert.equal(link.params.aff_id, "abc");
});

test("host match is exact and case-insensitive", () => {
  const link = buildTrackedUrl(input({ destination: "https://ALPHA.example/trade" }));
  assert.equal(new URL(link.href).hostname, "alpha.example");
  assert.equal(link.href.startsWith("https://alpha.example/"), true);
});

test("open redirects and non-https destinations are rejected", () => {
  const rejected = [
    "http://alpha.example/trade",
    "https://evil.example/trade",
    "https://alpha.example.evil.example/trade",
    "https://user:pass@alpha.example/trade",
    "https://alpha.example:444/trade",
    "https://127.0.0.1/trade",
    "javascript:alert(1)",
    "https://evil.example/alpha.example",
    "//alpha.example/trade",
    "https://alpha.example%00.evil.example/trade",
    "https://alpha.example%2e.evil.example/trade",
  ];
  for (const destination of rejected) {
    assert.throws(() => buildTrackedUrl(input({ destination, allowedHosts: ["alpha.example", "127.0.0.1"] })), OutboundUrlError);
  }
});

test("a canonical url is never on a different host", () => {
  const tricky = [
    "https://alpha.example/trade",
    "https://alpha.example%2f.evil.example/trade",
    "https://alpha.example%23.evil.example/trade",
    "https://alpha.example#@evil.example",
    "https://evil.example\\@alpha.example/",
  ];
  for (const destination of tricky) {
    try {
      const link = buildTrackedUrl(input({ destination }));
      const url = new URL(link.href);
      assert.equal(url.hostname, "alpha.example");
      assert.equal(url.protocol, "https:");
      assert.equal(link.href.startsWith("https://alpha.example/"), true);
    } catch (error) {
      assert.ok(error instanceof OutboundUrlError);
    }
  }
});

test("static params cannot carry an email or replace utm fields", () => {
  assert.throws(() => buildTrackedUrl(input({ staticParams: { aff_id: "a@b.com" } })), OutboundUrlError);
  assert.throws(() => buildTrackedUrl(input({ staticParams: { utm_source: "other" } })), OutboundUrlError);
  assert.throws(() => buildTrackedUrl(input({ clickIdParam: "utm_source" })), OutboundUrlError);
  assert.throws(() => buildTrackedUrl(input({ utmSource: "not a source" })), OutboundUrlError);
  assert.throws(() => buildTrackedUrl(input({ clickId: "not-a-uuid" })), OutboundUrlError);
});

test("click ids are uuid v7 and ip hashes rotate daily without storing the address", () => {
  const id = uuidv7(1_700_000_000_000);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const secret = "0123456789abcdef0123456789abcdef";
  const day = new Date("2026-10-29T12:00:00.000Z");
  const next = new Date("2026-10-30T12:00:00.000Z");
  const first = hashIpUa("203.0.113.8", "Mozilla", secret, day);
  assert.equal(first, hashIpUa("203.0.113.8", "Mozilla", secret, day));
  assert.notEqual(first, hashIpUa("203.0.113.8", "Mozilla", secret, next));
  assert.equal(hashIpUa(null, "Mozilla", secret, day), null);
  assert.equal(hashIpUa("203.0.113.8", "Mozilla", "short", day), null);
  assert.equal(first?.includes("203.0.113.8"), false);
});

test("prefetch and HEAD are not clicks, and the referrer path drops the query", () => {
  assert.equal(isNonClick("HEAD", { get: () => null }), true);
  assert.equal(isNonClick("GET", { get: (name) => (name === "purpose" ? "prefetch" : null) }), true);
  assert.equal(isNonClick("GET", { get: (name) => (name === "sec-purpose" ? "prefetch;prerender" : null) }), true);
  assert.equal(isNonClick("GET", { get: () => null }), false);
  const path = safeReferrerPath("https://resparts.vercel.app/en/sell/apple/iphone-15-pro?storage=256&condition=A", [
    "https://resparts.vercel.app",
  ]);
  assert.equal(path, "/en/sell/apple/iphone-15-pro");
  assert.equal(localeFromPath(path), "en");
  assert.equal(localeFromPath("/sell/apple/iphone-15-pro"), "he");
  assert.equal(safeReferrerPath("https://evil.example/sell/apple", ["https://resparts.vercel.app"]), null);
  const normalized = safeReferrerPath("https://resparts.vercel.app/../secret", ["https://resparts.vercel.app"]);
  assert.equal(normalized, "/secret");
  assert.equal(normalized?.includes(".."), false);
});

test("click rate limit is independent and returns retry-after", () => {
  const now = 1_000_000;
  for (let i = 0; i < 30; i += 1) assert.equal(allowClick("203.0.113.9", now).ok, true);
  const blocked = allowClick("203.0.113.9", now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfter >= 1, true);
  assert.equal(allowClick("203.0.113.10", now).ok, true);
  assert.equal(clientIp("203.0.113.9, 10.0.0.1"), "203.0.113.9");
  assert.equal(clientIp("not-an-ip"), null);
});

test("the secret key and noreferrer stay out of the public offer link", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx|js|mjs|css)$/.test(entry)) files.push(path);
    }
  };
  walk(root);
  const needle = ["process.env.", "SUPABASE_SECRET_KEY"].join("");
  const secretHits = files.filter((path) => !path.endsWith(".test.ts") && readFileSync(path, "utf8").includes(needle));
  assert.deepEqual(
    secretHits.map((path) => path.slice(root.length + 1)),
    ["lib/server/clicks.ts"],
  );
  const offerList = readFileSync(join(root, "components/public/OfferList.tsx"), "utf8");
  assert.match(offerList, /href=\{`\/go\/\$\{offer\.offer_ref\}`\}/);
  assert.match(offerList, /rel="sponsored nofollow noopener"/);
  assert.equal(offerList.includes("noreferrer"), false);
  assert.equal(offerList.includes("destination_url"), false);
});
