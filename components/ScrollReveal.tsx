"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Subtiele fade-up-bij-scrollen voor de marketing-landingspagina (app/
 * page.tsx) — de bestaande `animate-fade-up`-utility (globals.css) is
 * mount-getriggerd, wat volstaat voor in-app lijsten die al in beeld staan
 * bij het renderen, maar niet voor landingspagina-secties die initieel ver
 * onder de vouw staan. Eenmalig: een sectie blijft zichtbaar zodra 'm één
 * keer in beeld is geweest — opnieuw verbergen bij terugscrollen zou
 * afleiden, niet "subtiel" aanvoelen zoals de brief vraagt.
 */
export function ScrollReveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Lazy initializer i.p.v. setState binnen het effect hieronder: een
  // browser zonder IntersectionObserver toont de sectie meteen zichtbaar
  // i.p.v. voor altijd verborgen te blijven.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-brand motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
