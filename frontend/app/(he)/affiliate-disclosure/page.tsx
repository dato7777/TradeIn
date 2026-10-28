import type { Metadata } from "next";
import { AffiliateView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "גילוי נאות על עמלות | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AffiliateView locale="he" />;
}
