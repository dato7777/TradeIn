"use client";

import PublicSegmentError from "@/components/public/PublicSegmentError";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PublicSegmentError reset={reset} />;
}
