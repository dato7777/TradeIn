import { notFound } from "next/navigation";
import { PublicPlaceholder } from "@/components/public/PublicPlaceholder";
import { isRetiredAccountPath } from "@/lib/public/retiredPaths";

export default function HebrewPlaceholder({ params }: { params: { rest: string[] } }) {
  if (isRetiredAccountPath(params.rest)) notFound();
  return <PublicPlaceholder locale="he" />;
}
