import type { Metadata } from "next";
import { FaqView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "שאלות נפוצות | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FaqView locale="he" />;
}
