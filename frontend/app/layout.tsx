import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RES PARTS — Grade Price Comparison",
  description: "Compare mobile trade-in grade prices across Israeli companies",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = headers().get("x-public-locale");
  const lang = locale === "he" ? "he" : "en";
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
