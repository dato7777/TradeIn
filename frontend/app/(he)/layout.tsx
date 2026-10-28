import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "השוואת טרייד-אין",
  description: "משווים מחירי טרייד-אין לטלפון שלכם במקום אחד",
  robots: { index: false, follow: false },
};

export default function HebrewPublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell locale="he">{children}</PublicShell>;
}
