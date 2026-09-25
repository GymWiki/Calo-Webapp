"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// navigator.share support never changes mid-session, but is only knowable
// client-side — useSyncExternalStore (server snapshot false, no-op
// subscribe) resyncs it right after hydration without a mismatch flash. Same
// pattern as ShareLessonButton.tsx.
function subscribeNever() {
  return () => {};
}
function getCanShareSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
function getCanShareServerSnapshot() {
  return false;
}
function useCanNativeShare() {
  return useSyncExternalStore(subscribeNever, getCanShareSnapshot, getCanShareServerSnapshot);
}

/**
 * Simpele share-actie voor de eenvoudige-activiteit-detailpagina — geen
 * dialoog/openbaar-toggle zoals ShareLessonButton.tsx (dat is specifiek voor
 * eigen, wizard-gemaakte activiteiten met een is_public-schakelaar): hier
 * gewoon de huidige pagina-URL delen via de Web Share API (mobiel, als
 * ondersteund) of anders naar het klembord kopiëren.
 */
export function ShareActivityButton({
  title,
  className,
  size,
  iconOnly = false,
}: {
  title: string;
  className?: string;
  size?: "default" | "sm";
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useCanNativeShare();

  async function handleShare() {
    const url = window.location.href;

    if (canNativeShare) {
      try {
        await navigator.share({ title, text: `Bekijk deze activiteit op GymWiki: ${title}`, url });
      } catch {
        // Gebruiker annuleerde de native share-sheet — geen foutmelding nodig.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link gekopieerd naar klembord.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren is mislukt. Probeer het opnieuw.");
    }
  }

  const Icon = copied ? Check : Share2;
  const label = copied ? "Gekopieerd" : "Delen";

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        onClick={handleShare}
        aria-label={label}
        title={label}
      >
        <Icon className="size-4" />
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size={size} className={className} onClick={handleShare}>
      <Icon className="size-4" />
      {label}
    </Button>
  );
}
