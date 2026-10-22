"use client";

import { useRef } from "react";

const SWIPE_THRESHOLD_X = 50;
const SWIPE_MAX_DRIFT_Y = 60;

/**
 * Gedeelde swipe-navigatie voor horizontaal bladerbare planning-weergaven
 * (de klas-detailpagina's maandlijst, het weekrooster) — geëxtraheerd uit
 * de eerdere MonthCalendar-only implementatie zodra een tweede plek
 * dezelfde logica nodig had. 50px horizontale beweging telt als swipe; een
 * verticale drift van meer dan 60px wordt genegeerd zodat verticaal
 * scrollen niet per ongeluk een navigatie triggert. Swipe naar links (vinger
 * beweegt naar links, delta negatief) = vooruit/volgende; swipe naar rechts
 * = terug/vorige — dezelfde richting-conventie als een fysieke agenda.
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
}: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_X || Math.abs(deltaY) > SWIPE_MAX_DRIFT_Y) return;

    if (deltaX > 0) {
      onSwipeRight();
    } else {
      onSwipeLeft();
    }
  }

  return { onTouchStart, onTouchEnd };
}
