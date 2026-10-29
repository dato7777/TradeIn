import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderAlert, renderConfirmation } from "../lib/alerts/templates";

const out = path.join(process.cwd(), ".email-preview");

const samples = [
  { kind: "up" as const, oldPrice: 1780, newPrice: 1900, percent: 6.7 },
  { kind: "down" as const, oldPrice: 1900, newPrice: 1700, percent: 10.5 },
  { kind: "available" as const, oldPrice: null, newPrice: 1600, percent: 0 },
];

async function main() {
  await mkdir(out, { recursive: true });

  for (const locale of ["en", "he"] as const) {
  const confirmation = await renderConfirmation({
    locale,
    siteName: locale === "he" ? "השוואת טרייד-אין" : "Trade-in Compare",
    phone: "iPhone 13 · 128 GB · A",
    priceLabel: locale === "he" ? "₪1,780" : "₪1,780",
    confirmUrl: "https://example.com/alerts/confirm?token=preview",
    unsubscribeUrl: "https://example.com/alerts/unsubscribe?token=preview",
    replyTo: "reply@example.com",
    hours: 48,
    adLabel: false,
  });
      await writeFile(path.join(out, `confirmation-${locale}.html`), confirmation.html);
      await writeFile(path.join(out, `confirmation-${locale}.txt`), confirmation.text);
  for (const sample of samples) {
    const alert = await renderAlert({
      locale,
      siteName: locale === "he" ? "השוואת טרייד-אין" : "Trade-in Compare",
      kind: sample.kind,
      phone: "iPhone 13 · 128 GB · A",
      model: "iPhone 13",
      oldPrice: sample.oldPrice,
      newPrice: sample.newPrice,
      percent: sample.percent,
      offers: [
        { company: "Alpha", price: sample.newPrice },
        { company: "Beta", price: sample.newPrice - 20 },
      ],
      offerUrl: "https://example.com/sell/apple/iphone-13?storage=128&condition=A",
      unsubscribeUrl: "https://example.com/alerts/unsubscribe?token=preview",
      replyTo: "reply@example.com",
      adLabel: false,
    });
      await writeFile(path.join(out, `alert-${sample.kind}-${locale}.html`), alert.html);
      await writeFile(path.join(out, `alert-${sample.kind}-${locale}.txt`), alert.text);
    }
  }
}

void main();
