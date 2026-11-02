"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MANAGE_URLS } from "@/lib/subscription/entitlement";
import type { StoreOffer } from "@/lib/mobile/purchases";

const LABEL = { monthly: "Maandelijks", yearly: "Jaarlijks" } as const;
const PERIOD = { monthly: "per maand", yearly: "per jaar" } as const;

/**
 * Paywall in de native app: ALLEEN aankopen via de App Store / Google Play
 * (Apple 3.1.1). Bewust géén Stripe, geen links naar de website-betaling en
 * geen verwijzing naar andere prijzen. Prijs en proefperiode komen uit de
 * store (lib/mobile/purchases.ts).
 */
export function StorePaywall({ userId, platform }: { userId: string; platform: "ios" | "android" }) {
  const router = useRouter();
  const [offers, setOffers] = useState<StoreOffer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const storeName = platform === "ios" ? "App Store" : "Google Play";
  const manageUrl = platform === "ios" ? MANAGE_URLS["app-store"] : MANAGE_URLS["google-play"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = await import("@/lib/mobile/purchases");
        if (!(await api.identify(userId))) throw new Error("not-configured");
        const loaded = await api.loadOffers();
        if (!cancelled) setOffers(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // De webhook werkt de toegang bij; kort wachten en dan de pagina verversen.
  function refreshSoon() {
    setTimeout(() => startTransition(() => router.refresh()), 2500);
  }

  async function buy(offer: StoreOffer) {
    setBusy(offer.id);
    const api = await import("@/lib/mobile/purchases");
    const result = await api.purchase(offer);
    setBusy(null);
    if (result === "purchased") {
      toast.success("Gelukt! Je toegang wordt bijgewerkt.");
      refreshSoon();
    } else if (result === "error") {
      toast.error("De aankoop is niet gelukt. Probeer het later opnieuw.");
    }
  }

  async function restore() {
    setBusy("restore");
    const api = await import("@/lib/mobile/purchases");
    const result = await api.restore();
    setBusy(null);
    if (result === "restored") {
      toast.success("Aankopen hersteld.");
      refreshSoon();
    } else if (result === "nothing") {
      toast.message("Geen eerdere aankopen gevonden voor dit account.");
    } else {
      toast.error("Herstellen is niet gelukt. Probeer het later opnieuw.");
    }
  }

  if (failed) {
    return <p className="text-center text-sm text-muted-foreground">Het aanbod kon niet worden geladen. Controleer je verbinding en probeer het later opnieuw.</p>;
  }
  if (!offers) {
    return <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="store-paywall">
      <div className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <div key={offer.id} className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">{LABEL[offer.id]}</h3>
            <p className="text-2xl font-semibold">
              {offer.priceString} <span className="text-sm font-normal text-muted-foreground">{PERIOD[offer.id]}</span>
            </p>
            {offer.trialDays > 0 ? (
              <p className="text-sm text-muted-foreground">
                {offer.trialDays} dagen gratis proberen, daarna {offer.priceString} {PERIOD[offer.id]}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Op elk moment opzegbaar.</p>
            )}
            <Button type="button" size="lg" className="w-full" disabled={busy !== null} onClick={() => buy(offer)}>
              {busy === offer.id && <Loader2 className="size-4 animate-spin" />}
              {offer.trialDays > 0 ? `${offer.trialDays} dagen gratis proberen` : "Abonneren"}
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" className="w-full" disabled={busy !== null} onClick={restore}>
        {busy === "restore" && <Loader2 className="size-4 animate-spin" />} Aankopen herstellen
      </Button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {offers.some((o) => o.trialDays > 0) && "De proefperiode is alleen voor nieuwe abonnees. "}
        Je abonnement wordt via je {storeName}-account in rekening gebracht en verlengt automatisch voor dezelfde periode,
        tenzij je minstens 24 uur voor het einde van de lopende periode (of proefperiode) opzegt. Beheren of opzeggen kan
        op elk moment via{" "}
        <a href={manageUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">Abonnementen beheren in de {storeName}</a>.{" "}
        <Link href="/voorwaarden" className="underline underline-offset-2">Gebruiksvoorwaarden</Link> ·{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacyverklaring</Link>
      </p>
    </div>
  );
}
