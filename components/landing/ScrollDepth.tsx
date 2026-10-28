"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics/track";

const STEPS = [25, 50, 75, 100];

/** Geeft één keer per drempel (25/50/75/100 %) een scrolldiepte-event af, met onzichtbare markeringen en IntersectionObserver (geen scroll-listener). */
export function ScrollDepth({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const fired = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const step = Number((entry.target as HTMLElement).dataset.depth);
        if (entry.isIntersecting && !fired.has(step)) {
          fired.add(step);
          trackEvent("landing_scrolldiepte", { procent: step });
          observer.unobserve(entry.target);
        }
      }
    });
    document.querySelectorAll("[data-depth]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {children}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px">
        {STEPS.map((step) => (
          <span key={step} data-depth={step} className="absolute left-0 block h-px w-px" style={{ top: step === 100 ? "calc(100% - 2px)" : `${step}%` }} />
        ))}
      </div>
    </div>
  );
}
