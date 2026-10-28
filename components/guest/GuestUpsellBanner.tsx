"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";

import { trackEvent } from "@/lib/analytics/track";

/**
 * Zachte upsell na opslaan/exporteren: nooit blokkerend (alleen de kaart zelf vangt klikken, het canvas eronder blijft bruikbaar)
 * en altijd te sluiten. De plattegrond blijft lokaal bewaard en wordt na registreren/inloggen aangeboden.
 */
export function GuestUpsellBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    trackEvent("upsell_getoond");
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center px-3 lg:bottom-4" data-testid="gast-upsell">
      <div
        role="status"
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-2xl border bg-card/95 p-3 pr-2 text-sm shadow-lg backdrop-blur-sm"
      >
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Maak een gratis account</strong> om je plattegrond in de cloud te bewaren, te koppelen aan een
          activiteit en te delen met collega&apos;s. Wat je nu hebt gemaakt, nemen we mee.{" "}
          <Link href="/register" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => trackEvent("account_aangemaakt_vanuit_editor", { stap: "klik" })}>
            Account maken
          </Link>
        </p>
        <button
          type="button"
          aria-label="Melding sluiten"
          onClick={onDismiss}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
