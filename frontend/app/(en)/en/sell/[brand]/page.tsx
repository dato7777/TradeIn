import type { Metadata } from "next";
import { BrandView, brandTitle } from "@/components/public/BrandView";
import { siteOrigin } from "@/lib/public/format";
import { brandSchema } from "@/lib/public/schemas";

type Params = { brand: string };

export function generateMetadata({ params }: { params: Params }): Metadata {
  const title = brandTitle("en", params.brand);
  const origin = siteOrigin();
  const brand = brandSchema.safeParse(params.brand).success ? params.brand : "";
  return {
    title: title ?? "Trade-in Compare",
    robots: { index: false, follow: false },
    alternates: brand
      ? {
          canonical: `${origin}/en/sell/${brand}`,
          languages: { he: `${origin}/sell/${brand}`, en: `${origin}/en/sell/${brand}` },
        }
      : undefined,
  };
}

export default function Page({ params }: { params: Params }) {
  return <BrandView locale="en" brand={params.brand} />;
}
