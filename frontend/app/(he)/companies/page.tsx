import type { Metadata } from "next";
import { CompaniesView } from "@/components/public/CatalogViews";

export const metadata: Metadata = {
  title: "חברות | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CompaniesView locale="he" />;
}
