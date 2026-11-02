"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

async function callSync(): Promise<{ status?: string; paid?: boolean; error?: string }> {
  const res = await fetch("/api/stripe/sync", { method: "POST", cache: "no-store" });
  return res.json().catch(() => ({ error: "Onverwacht antwoord." }));
}

/** Knop "Abonnement synchroniseren": vraagt bij Stripe na of je betaald hebt en herstelt je toegang. */
export function SyncSubscriptionButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const result = await callSync();
      if (result.error) toast.error(result.error);
      else if (result.status === "synced" && result.paid) {
        toast.success("Je abonnement is gesynchroniseerd — je hebt volledige toegang.");
        router.refresh();
      } else if (result.status === "synced") toast.message("Je abonnement is gevonden, maar is niet (meer) actief.");
      else if (result.status === "rate_limited") toast.message("Even geduld — probeer het over een halve minuut opnieuw.");
      else toast.message("We vonden geen betaald abonnement bij dit account. Betaalde je met een ander e-mailadres? Mail info@gymwiki.nl.");
    } catch {
      toast.error("Synchroniseren is nu niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" className={className} disabled={busy} onClick={handle}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Abonnement synchroniseren
    </Button>
  );
}

/** Stille controle bij het openen van de accountpagina's: herstelt automatisch een gemist abonnement (server is rate-limited). */
export function SubscriptionSelfHeal() {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Hoogstens één stille controle per browsersessie (Stripe-aanroepen beperken).
    try {
      if (sessionStorage.getItem("gymwiki.subscription-heal")) return;
      sessionStorage.setItem("gymwiki.subscription-heal", "1");
    } catch {
      // geen sessionStorage: dan gewoon doorgaan, de server is zelf ook rate-limited
    }
    void callSync()
      .then((r) => {
        if (r.status === "synced" && r.paid) router.refresh();
      })
      .catch(() => undefined);
  }, [router]);
  return null;
}
