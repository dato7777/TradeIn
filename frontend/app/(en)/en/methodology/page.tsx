import type { Metadata } from "next";
import { MethodologyView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "How we rank | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MethodologyView locale="en" />;
}
