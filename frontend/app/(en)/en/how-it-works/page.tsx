import type { Metadata } from "next";
import { HowView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "How it works | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HowView locale="en" />;
}
