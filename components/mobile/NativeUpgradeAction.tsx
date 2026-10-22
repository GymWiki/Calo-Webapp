"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Vervangt de per-kaart ProCheckoutButton (zie
 * components/subscription/{ProCheckoutButton,SubscriptionPlansSection}.tsx)
 * wanneer de app in de native iOS/Android-context draait — Apple en Google
 * staan geen ingebedde betaalervaring voor een digitaal abonnement toe
 * binnen de app/WebView zelf, voor geen van de drie plannen (maandelijks/
 * jaarlijks/lifetime). In plaats daarvan: één gedeelde link die de
 * systeem-browser opent naar de bestaande, ongewijzigde webbetaalflow op
 * gymwiki.nl, waar de gebruiker alsnog tussen de drie opties kiest. Bewust
 * geen prijs of wervende tekst hier — alleen de neutrale, feitelijke
 * toelichting die Apple's "neutral disclosure"-eis voorschrijft bij dit
 * soort externe links (zie /pro/page.tsx voor waar prijs/features wél
 * staan, die pagina wordt gewoon in de browser getoond).
 */
export function NativeUpgradeAction({ className }: { className?: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleOpen() {
    setIsPending(true);
    try {
      const { openInSystemBrowser } = await import("@/lib/mobile/capacitor");
      await openInSystemBrowser("https://www.gymwiki.nl/pro?native=1");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className={className}
        disabled={isPending}
        onClick={handleOpen}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
        Abonnement afsluiten op gymwiki.nl
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Je wordt doorgestuurd naar onze website om je abonnement af te ronden.
      </p>
    </div>
  );
}
