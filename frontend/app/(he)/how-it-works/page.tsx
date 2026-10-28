import type { Metadata } from "next";
import { HowView } from "@/components/public/InfoViews";

export const metadata: Metadata = {
  title: "איך זה עובד | השוואת טרייד-אין",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HowView locale="he" />;
}
