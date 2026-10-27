"use client";

import { useState } from "react";
import Image from "next/image";
import { Box, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MaterialModel } from "@/types/materialModel";
import type { LibraryView } from "@/components/library/useLibraryPrefs";

/** Preview-vlak: de PNG's hebben een transparante achtergrond, dus altijd op
 * een vaste lichte ondergrond (ook in dark mode) zodat donkere materialen
 * zichtbaar blijven. `object-contain` + padding: nooit bijsnijden. */
function ModelPreview({ model, compact }: { model: MaterialModel; compact: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-50 ring-1 ring-black/5",
        compact ? "size-10 shrink-0" : "aspect-[4/3] w-full",
      )}
    >
      {model.devColor ? (
        <div className="absolute inset-2 rounded-md" style={{ backgroundColor: model.devColor }} aria-hidden="true" />
      ) : !model.preview_url || failed ? (
        <div className="flex size-full items-center justify-center text-slate-400">
          <Box className={compact ? "size-4" : "size-8"} aria-hidden="true" />
        </div>
      ) : (
        <Image
          src={model.preview_url}
          alt=""
          fill
          sizes={compact ? "40px" : "(min-width: 1024px) 128px, 33vw"}
          className={cn("object-contain", compact ? "p-0.5" : "p-1.5")}
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
}

function FavoriteStar({
  naam,
  favorite,
  onToggle,
  className,
}: {
  naam: string;
  favorite: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `${naam} uit favorieten halen` : `${naam} als favoriet markeren`}
      title={favorite ? "Uit favorieten halen" : "Als favoriet markeren"}
      onClick={onToggle}
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-brand hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        favorite && "text-primary",
        className,
      )}
    >
      <Star className={cn("size-4", favorite && "fill-current")} aria-hidden="true" />
    </button>
  );
}

/** Eén item als grote kaart of compacte rij. Kaart en ster zijn twee losse knoppen (geen geneste buttons). */
export function ModelItem({
  model,
  view,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  model: MaterialModel;
  view: LibraryView;
  favorite: boolean;
  onSelect: (model: MaterialModel) => void;
  onToggleFavorite: (slug: string) => void;
}) {
  const compact = view === "list";

  return (
    <div className={cn("group relative min-w-0", compact && "flex items-center gap-1")}>
      <button
        type="button"
        onClick={() => onSelect(model)}
        title={model.naam}
        aria-label={`${model.naam} toevoegen aan de plattegrond`}
        className={cn(
          "min-w-0 rounded-lg border bg-background text-left transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95",
          compact ? "flex flex-1 items-center gap-2 p-1" : "flex w-full flex-col gap-1.5 p-1.5",
        )}
      >
        <ModelPreview model={model} compact={compact} />
        <span
          className={cn(
            "min-w-0 text-xs leading-tight font-medium break-words",
            compact ? "line-clamp-2 flex-1" : "line-clamp-2 min-h-[2.2em] w-full px-0.5",
          )}
        >
          {model.naam}
        </span>
      </button>
      <FavoriteStar
        naam={model.naam}
        favorite={favorite}
        onToggle={() => onToggleFavorite(model.slug)}
        className={cn(
          compact
            ? "shrink-0"
            : "absolute top-1.5 right-1.5 bg-background/80 opacity-100 backdrop-blur-sm lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100",
          favorite && "lg:opacity-100",
        )}
      />
    </div>
  );
}
