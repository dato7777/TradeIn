import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
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
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
