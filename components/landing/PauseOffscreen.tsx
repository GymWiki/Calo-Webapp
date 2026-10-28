"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Zet `data-paused="true"` zodra het blok uit beeld is (of het tabblad op de achtergrond staat); de CSS in globals.css
 * pauzeert daarmee de animaties. Zonder IntersectionObserver blijft de animatie gewoon lopen.
 */
export function PauseOffscreen({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    const onVisibility = () => {
      if (document.hidden) setVisible(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={ref} className={className} data-paused={visible ? "false" : "true"}>
      {children}
    </div>
  );
}
