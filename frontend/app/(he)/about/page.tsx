import type { Metadata } from "next";
import { AboutView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "אודות | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AboutView locale="he" />;
}
