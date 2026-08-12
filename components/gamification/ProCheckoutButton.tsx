"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ProCheckoutButton({ className }: { className?: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleCheckout() {
    setIsPending(true);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || "error" in result) {
        toast.error(result.error ?? "Upgraden is mislukt. Probeer het opnieuw.");
        return;
      }

      window.location.href = result.url;
    } catch {
      toast.error("Upgraden is mislukt. Controleer je verbinding.");
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
      {isPending ? "Bezig..." : "Upgrade naar Pro"}
    </Button>
  );
}
