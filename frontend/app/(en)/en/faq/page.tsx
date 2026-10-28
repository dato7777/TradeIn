import type { Metadata } from "next";
import { FaqView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "FAQ | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FaqView locale="en" />;
}
