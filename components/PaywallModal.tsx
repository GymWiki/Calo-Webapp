"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatEuroCents,
  getDiscountedPriceCents,
  getLevelInfo,
} from "@/lib/gamification";

const PRO_BENEFITS = [
  "Onbeperkt PDF printen",
  "Kopieer-knop op elke activiteit",
  "Eigen Kennisbank (RAG) voor de AI Lescoach",
  "Onbeperkt AI Lescoach & Activiteiten Generator",
];

/**
 * Mobielvriendelijke paywall, getriggerd vanuit elke Pro-gated actie
 * (PDF-export, Kopieer & bewerk, max. opgeslagen lessen, AI-limiet,
 * eigen Kennisbank). `message` is de specifieke reden waarom deze
 * gebruiker 'm nu ziet; de rest van de inhoud is vast. `xp` bepaalt de
 * dynamische kortingsbadge — 0 (of het level-1 geval) toont geen badge.
 */
export function PaywallModal({
  open,
  onOpenChange,
  message,
  xp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  xp: number;
}) {
  const level = getLevelInfo(xp);
  const hasDiscount = level.freeDiscountPercent > 0;
  const discountedPriceCents = getDiscountedPriceCents(level.freeDiscountPercent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Ontgrendel het maximale uit je bewegingsonderwijs
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {benefit}
            </li>
          ))}
        </ul>

        {hasDiscount && (
          <div className="rounded-lg border border-cone/40 bg-cone/10 px-3 py-2.5 text-sm">
            Jij hebt al <strong>Level {level.level}</strong> bereikt! Jouw
            prijs: <strong>{formatEuroCents(discountedPriceCents)}/mnd</strong>
          </div>
        )}

        <Button asChild size="lg" className="w-full">
          <Link href="/pro">
            <Sparkles className="size-4" />
            Upgrade naar Pro
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
