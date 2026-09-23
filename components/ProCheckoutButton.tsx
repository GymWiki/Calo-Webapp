"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeUpgradeAction } from "@/components/mobile/NativeUpgradeAction";
import { useIsNativeApp } from "@/lib/mobile/useIsNativeApp";

/**
 * Enige plek in de app die daadwerkelijk een Stripe-checkout-sessie
 * aanmaakt (zie app/(protected)/pro/page.tsx — alle andere upgrade-CTA's
 * in de app linken alleen naar /pro toe, ze roepen dit nooit rechtstreeks
 * aan). Binnen de native app mag deze ingebedde checkout-ervaring van
 * Apple/Google niet getoond worden — useIsNativeApp() schakelt dan over op
 * NativeUpgradeAction (systeem-browser-link), zonder dat een van die
 * andere CTA's hoeft te weten of ze in de native app draaien: ze linken
 * toch al alleen naar deze pagina.
 */
export function ProCheckoutButton({ className }: { className?: string }) {
  const isNative = useIsNativeApp();
  const [isPending, setIsPending] = useState(false);

  if (isNative) {
    return <NativeUpgradeAction className={className} />;
  }

  async function handleCheckout() {
    setIsPending(true);
    try {
      // `native=1` in de URL betekent: deze /pro-pagina is geopend vanuit de
      // systeem-browser-link in de native app (zie NativeUpgradeAction) —
      // stuur dat door zodat de succes-/annuleer-redirect straks een "Terug
      // naar de app"-knop kan tonen (zie app/api/stripe/create-checkout/route.ts
      // en app/(protected)/pro/page.tsx). Een gewone window.location.search-
      // lezing i.p.v. useSearchParams(): dat laatste zou deze knop (en dus
      // heel /pro) in een Suspense-boundary moeten wikkelen voor niets meer
      // dan een eenmalige lezing bij klikken.
      const native = new URLSearchParams(window.location.search).get("native") === "1";
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ native }),
      });
      const result = await response.json();

      if (!response.ok || "error" in result) {
        toast.error(result.error ?? "Abonneren is mislukt. Probeer het opnieuw.");
        return;
      }

      window.location.href = result.url;
    } catch {
      toast.error("Abonneren is mislukt. Controleer je verbinding.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      className={className}
      disabled={isPending}
      onClick={handleCheckout}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {isPending ? "Bezig..." : "Abonneren"}
    </Button>
  );
}
