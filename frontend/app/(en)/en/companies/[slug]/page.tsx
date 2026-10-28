import type { Metadata } from "next";
import { CompanyView } from "@/components/public/CatalogViews";

type Params = { slug: string };

export const metadata: Metadata = {
  title: "Company | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: Params }) {
  return <CompanyView locale="en" slug={params.slug} />;
}
