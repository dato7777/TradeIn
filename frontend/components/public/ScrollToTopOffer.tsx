"use client";

import { useEffect } from "react";

export function ScrollToTopOffer() {
  useEffect(() => {
    const offer = document.getElementById("top-offer");
    if (!offer) return;
    offer.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return null;
}
