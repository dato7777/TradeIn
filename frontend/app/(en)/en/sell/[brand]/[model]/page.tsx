import type { Metadata } from "next";
import { ModelView, modelMetadata } from "@/components/public/ModelView";

type Params = { brand: string; model: string };

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return modelMetadata("en", params.brand, params.model);
}

export default function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: { storage?: string | string[]; condition?: string | string[] };
}) {
  return (
    <ModelView
      locale="en"
      brand={params.brand}
      modelSlug={params.model}
      storageParam={searchParams.storage}
      conditionParam={searchParams.condition}
    />
  );
}
