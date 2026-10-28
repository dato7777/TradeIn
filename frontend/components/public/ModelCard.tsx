import Link from "next/link";
import { modelPath } from "@/lib/public/paths";
import type { PublicLocale } from "@/lib/publicCopy";

export function ModelCard({
  locale,
  brand,
  slug,
  name,
}: {
  locale: PublicLocale;
  brand: string;
  slug: string;
  name: string;
}) {
  return (
    <li>
      <Link
        href={modelPath(locale, brand, slug)}
        className="flex min-h-11 items-center rounded-xl border border-pub-border bg-white p-4 text-base font-semibold shadow-sm hover:border-pub-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
      >
        {name}
      </Link>
    </li>
  );
}
