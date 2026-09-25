"use client";

import { useState } from "react";
import { ImageOff, Maximize2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Gedeelde lightbox voor elke arrangement-/plattegrondafbeelding op de
 * activiteit-detailpagina (zowel de eenvoudige bibliotheek-activiteiten als
 * de wizard-plattegrond delen 'm nu, i.p.v. dat de wizard-variant een kale
 * `<img>` zonder vergrootactie had). De "vergroot"-hint is altijd zichtbaar
 * — niet pas bij hover — want op een telefoon (de belangrijkste omgeving
 * voor deze pagina) bestaat er geen hover-state.
 */
export function ActivityImageLightbox({
  src,
  alt,
  emptyLabel = "Geen afbeelding beschikbaar.",
  className,
}: {
  src: string | null;
  alt: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-40 items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-4" aria-hidden="true" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block w-full overflow-hidden rounded-2xl border bg-muted",
          className,
        )}
        aria-label={`${alt} — vergroot afbeelding`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage) */}
        <img
          src={src}
          alt={alt}
          className="max-h-[320px] w-full object-contain transition-transform duration-200 ease-brand group-hover:scale-[1.01] sm:max-h-[400px] lg:max-h-[480px]"
          onError={() => setFailed(true)}
        />
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-medium text-white shadow-brand-sm">
          <Maximize2 className="size-3.5" aria-hidden="true" />
          Vergroot
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] p-2 sm:max-w-4xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
