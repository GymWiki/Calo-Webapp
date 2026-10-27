"use client";

import { Hand, Maximize2, Pointer } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gymwiki.editor.onboarding.v1";

export function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // geen localStorage: liever geen overlay bij elke bezoek
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // niet erg
  }
}

/** Eenmalige uitleg van de drie gebaren op telefoon/tablet; opnieuw te openen via "Uitleg gebaren". */
export function GestureOnboarding({ onClose }: { onClose: () => void }) {
  const gestures = [
    { icon: Hand, title: "1 vinger", text: "Sleep op een leeg stuk om de camera te draaien." },
    { icon: Maximize2, title: "2 vingers", text: "Knijp om te zoomen, schuif om te verplaatsen." },
    { icon: Pointer, title: "Tik", text: "Tik op een item om het te selecteren. Sleep het daarna om het te verplaatsen." },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Uitleg gebaren" className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Zo bedien je de editor</h2>
        <ul className="space-y-3">
          {gestures.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm">
                <strong className="block">{title}</strong>
                {text}
              </span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="h-12 w-full text-base"
          onClick={() => {
            markOnboardingSeen();
            onClose();
          }}
        >
          Begrepen
        </Button>
      </div>
    </div>
  );
}
