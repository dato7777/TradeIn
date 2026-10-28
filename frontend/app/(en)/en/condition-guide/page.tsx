import type { Metadata } from "next";
import { ConditionGuideView } from "@/components/public/CatalogViews";

export const metadata: Metadata = {
  title: "Condition guide | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ConditionGuideView locale="en" />;
}
