import { describe, expect, it } from "vitest";
import { renderAlert, renderConfirmation } from "@/lib/alerts/templates";

describe("templates", () => {
  it("renders both locales without remote images", async () => {
    for (const locale of ["en", "he"] as const) {
      const confirmation = await renderConfirmation({
        locale,
        siteName: locale === "he" ? "השוואת טרייד-אין" : "Trade-in Compare",
        phone: "iPhone 13 · 128 GB · A",
        priceLabel: "₪1,780",
        confirmUrl: "https://example.com/alerts/confirm?token=abc",
        unsubscribeUrl: "https://example.com/alerts/unsubscribe?token=abc",
        replyTo: "reply@example.com",
        hours: 48,
        adLabel: false,
      });
      const alert = await renderAlert({
        locale,
        siteName: locale === "he" ? "השוואת טרייד-אין" : "Trade-in Compare",
        kind: "up",
        phone: "iPhone 13 · 128 GB · A",
        model: "iPhone 13",
        oldPrice: 1780,
        newPrice: 1900,
        percent: 6.74,
        offers: [{ company: "Alpha", price: 1900 }],
        offerUrl: "https://example.com/sell/apple/iphone-13?storage=128&condition=A",
        unsubscribeUrl: "https://example.com/alerts/unsubscribe?token=abc",
        replyTo: "reply@example.com",
        adLabel: false,
      });
      expect(confirmation.html).toContain(`lang="${locale}"`);
      expect(alert.html).toContain(locale === "he" ? 'dir="rtl"' : 'dir="ltr"');
      expect(confirmation.html).not.toMatch(/src=/i);
      expect(alert.html).not.toMatch(/src=/i);
      expect(alert.subject).not.toContain("@");
      expect(alert.html).toMatchSnapshot(`${locale}-alert`);
      expect(confirmation.text).toMatchSnapshot(`${locale}-confirmation-text`);
    }
  });
});
