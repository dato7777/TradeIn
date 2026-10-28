import type { Metadata } from "next";
import { AffiliateView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "Affiliate disclosure | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AffiliateView locale="en" />;
}
