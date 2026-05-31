"use client";

import { useEffect, useState } from "react";

/** True below Tailwind `sm` (640px) — use tighter table column widths. */
export function useCompactTable() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return compact;
}
