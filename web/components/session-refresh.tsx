"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SessionRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restored);
    };
  }, [router]);
  return null;
}
