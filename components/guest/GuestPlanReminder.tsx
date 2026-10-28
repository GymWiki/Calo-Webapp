"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Sparkles, X } from "lucide-react";

import { draftStorageKey } from "@/components/canvas-3d/mobile/mobile-logic";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "gymwiki.guestplan.reminder.dismissed";

function readFlag(key: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

/** Dashboard-herinnering: er staat nog een plattegrond uit de gratis tool in deze browser. Verdwijnt zodra de editor hem herstelt of de gebruiker hem sluit. */
export function GuestPlanReminder() {
  const hasDraft = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const raw = window.localStorage.getItem(draftStorageKey(null));
        if (!raw) return false;
        const draft = JSON.parse(raw) as { items?: unknown[]; coneFields?: unknown[] };
        return (draft.items?.length ?? 0) + (draft.coneFields?.length ?? 0) > 0;
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" ? false : readFlag(DISMISS_KEY)));
  if (!hasDraft || dismissed) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Je plattegrond uit de gratis tool staat nog klaar</p>
        <p className="text-sm text-muted-foreground">Open de editor en herstel hem, dan bewaar je hem in je account en kun je hem aan een activiteit koppelen.</p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/plattegrond-3d">Open de editor</Link>
        </Button>
      </div>
      <button
        type="button"
        aria-label="Herinnering sluiten"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // geen localStorage
          }
          setDismissed(true);
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
