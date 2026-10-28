import type { Metadata } from "next";
import { MethodologyView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "איך אנחנו מדרגים | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MethodologyView locale="he" />;
}
