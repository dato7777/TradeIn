import { describe, expect, it } from "vitest";
import { formatIls, formatStorage } from "./price";

const digits = (value: string) => value.replace(/[^\d]/g, "");

describe("formatIls", () => {
  it("formats integer shekels without decimals in both locales", () => {
    for (const locale of ["he", "en"] as const) {
      const formatted = formatIls(2550, locale);
      expect(formatted).toContain("₪");
      expect(digits(formatted)).toBe("2550");
      expect(formatted).not.toMatch(/[.,]\d{2}\b(?!\d)/);
    }
  });

  it("rejects non-integer prices", () => {
    expect(() => formatIls(10.5, "he")).toThrow(RangeError);
    expect(() => formatIls(Number.NaN, "en")).toThrow(RangeError);
  });
});

describe("formatStorage", () => {
  it("labels GB and whole TB", () => {
    expect(formatStorage(128)).toBe("128GB");
    expect(formatStorage(1024)).toBe("1TB");
    expect(formatStorage(2048)).toBe("2TB");
  });

  it("rejects invalid sizes", () => {
    expect(() => formatStorage(0)).toThrow(RangeError);
    expect(() => formatStorage(1.5)).toThrow(RangeError);
  });
});
