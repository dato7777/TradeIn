import type { Metadata } from "next";
import { ConditionGuideView } from "@/components/public/CatalogViews";

export const metadata: Metadata = {
  title: "מדריך מצב המכשיר | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ConditionGuideView locale="he" />;
}
