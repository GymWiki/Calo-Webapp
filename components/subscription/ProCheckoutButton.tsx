"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@/lib/constants/subscriptionPlans";

/**
 * Enige plek in de app die daadwerkelijk een Stripe-checkout-sessie
 * aanmaakt (zie app/(protected)/pro/page.tsx — alle andere upgrade-CTA's in
 * de app linken alleen naar /pro toe, ze roepen dit nooit rechtstreeks aan).
 * Alleen gerenderd op het web — components/subscription/SubscriptionPlansSection.tsx
 * beslist vóór het renderen al of de native-app-gebruiker in plaats hiervan
 * NativeUpgradeAction (systeem-browser-link, zie components/mobile/) ziet,
 * zodat de ingebedde checkout-ervaring nooit binnen de native WebView
 * getoond wordt.
 */
export function ProCheckoutButton({
  plan,
  label,
  className,
}: {
  plan: SubscriptionPlan;
  label: string;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);

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
        body: JSON.stringify({ plan, native }),
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
      className={className}
      disabled={isPending}
      onClick={handleCheckout}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      {isPending ? "Bezig..." : label}
    </Button>
  );
}
