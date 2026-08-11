"use client";

import { useState } from "react";
import { Expand } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ActivityImageLightbox({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed">
        <p className="text-sm text-muted-foreground">
          Geen zaal-plattegrond beschikbaar.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border"
        aria-label="Bekijk afbeelding op volledig scherm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage) */}
        <img
          src={src}
          alt={alt}
          className="max-h-[420px] w-full object-contain bg-muted"
          onError={() => setFailed(true)}
        />
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Expand className="size-3.5" />
          Volledig scherm
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
