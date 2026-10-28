import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)),
  "utf8",
);

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token --color-${name} not found`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: Array<[foreground: string, background: string]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted", "background"],
  ["muted", "surface"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["cta-foreground", "cta"],
  ["cta-foreground", "cta-hover"],
  ["best-fg", "best-bg"],
  ["warning", "background"],
  ["error", "background"],
];

describe("design tokens meet WCAG 2.2 AA", () => {
  it.each(textPairs)("%s on %s has contrast >= 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring has >= 3:1 against the page background", () => {
    expect(contrast(token("focus"), token("background"))).toBeGreaterThanOrEqual(3);
  });
});
