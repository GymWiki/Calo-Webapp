"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Generieke "Terug"-knop: gaat naar de daadwerkelijke vorige pagina in de
 * navigatiegeschiedenis (router.back()) i.p.v. altijd naar een vaste,
 * hardcoded bestemming — dat voelde onlogisch wanneer de gebruiker
 * bijvoorbeeld vanuit het Dashboard of Profiel kwam in plaats van de
 * Bibliotheek. `fallbackHref`/`fallbackLabel` gelden alleen wanneer er geen
 * bruikbare geschiedenis is (een directe link, een ververste pagina, of
 * geopend in een nieuw tabblad) — window.history.length is pas na mount
 * bekend (geen `window` tijdens SSR), dus dat wordt pas client-side gelezen.
 * Het zichtbare label wisselt mee: "Terug" wanneer er daadwerkelijk terug
 * genavigeerd wordt, anders de naam van de vaste fallback-bestemming, zodat
 * de knoptekst nooit belooft ergens heen te gaan waar hij niet heen gaat.
 */
export function BackButton({
  fallbackHref,
  fallbackLabel,
  className,
  onBeforeNavigate,
}: {
  fallbackHref: string;
  fallbackLabel: string;
  className?: string;
  /** Best-effort hook (bijv. eerst een lopende autosave laten afronden) —
   * wordt afgewacht vóórdat er daadwerkelijk genavigeerd wordt, zodat er
   * niets verloren gaat. Zie lesson-form.tsx's flushAutosave. */
  onBeforeNavigate?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [hasHistory, setHasHistory] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Defaults to false for SSR (geen window server-side), dan bijgewerkt
    // zodra gemount — hetzelfde hydration-safe patroon als app/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHistory(window.history.length > 1);
  }, []);

  async function handleClick() {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      await onBeforeNavigate?.();
    } finally {
      if (hasHistory) {
        router.back();
      } else {
        router.push(fallbackHref);
      }
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isNavigating}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={() => void handleClick()}
    >
      <ArrowLeft className="size-4" />
      {hasHistory ? "Terug" : fallbackLabel}
    </Button>
  );
}
