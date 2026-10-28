import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Trade-in Compare",
  description: "Compare trade-in prices for your phone in one place",
  robots: { index: false, follow: false },
};

export default function EnglishPublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell locale="en">{children}</PublicShell>;
}
