import type { Metadata } from "next";
import { AboutView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "About | Trade-in Compare",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AboutView locale="en" />;
}
