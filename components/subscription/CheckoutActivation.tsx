"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Phase = "activating" | "done" | "slow";

const POLL_MS = 1500;
const MAX_POLLS = 14; // ~20 s

async function fetchPaid(): Promise<boolean> {
  try {
    const res = await fetch("/api/subscription/status", { cache: "no-store" });
    if (!res.ok) return false;
    return (await res.json()).paid === true;
  } catch {
    return false;
  }
}

/**
 * Succespagina na Stripe-checkout: wacht niet blind op de webhook. Eerst
 * bevestigen we de betaling server-side bij Stripe (idempotent), daarna
 * pollen we kort de pro-status (nooit gecachet). Lukt het niet binnen
 * enkele seconden: duidelijke melding met "Opnieuw proberen" en supportlink.
 */
export function CheckoutActivation({ sessionId, supportEmail = "info@gymwiki.nl" }: { sessionId: string | null; supportEmail?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("activating");
  const run = useRef(0);

  const start = useCallback(async (isCancelled: () => boolean = () => false) => {
    const id = ++run.current;
    const stale = () => isCancelled() || run.current !== id;

    if (sessionId) {
      try {
        const res = await fetch("/api/stripe/confirm-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
          cache: "no-store",
        });
        if (res.ok && (await res.json()).paid === true) {
          if (!stale()) {
            setPhase("done");
            router.refresh();
          }
          return;
        }
      } catch {
        // Netwerkfout: val terug op pollen (de webhook kan het alsnog afhandelen).
      }
    }

    for (let i = 0; i < MAX_POLLS; i++) {
      if (stale()) return;
      if (await fetchPaid()) {
        if (stale()) return;
        setPhase("done");
        router.refresh();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    if (!stale()) setPhase("slow");
  }, [router, sessionId]);

  useEffect(() => {
    let cancelled = false;
    void start(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [start]);

  if (phase === "done") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm" data-testid="checkout-done">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p>Gelukt! Je account is geactiveerd en je hebt nu volledige toegang.</p>
      </div>
    );
  }

  if (phase === "slow") {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm" data-testid="checkout-slow">
        <p>
          Je betaling is gelukt, maar het activeren duurt langer dan verwacht. Je hoeft niet opnieuw te betalen. Probeer het
          opnieuw, of mail ons via{" "}
          <a className="font-medium text-primary underline" href={`mailto:${supportEmail}?subject=Betaling%20niet%20geactiveerd`}>
            {supportEmail}
          </a>
          .
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPhase("activating");
            void start();
          }}
        >
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border p-4 text-sm" data-testid="checkout-activating">
      <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <p>We activeren je account…</p>
    </div>
  );
}
