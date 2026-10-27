"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Box, Loader2, Pencil, Plus } from "lucide-react";

import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Route van de enige plattegrondeditor, optioneel gekoppeld aan een activiteit en/of een bestaande plattegrond. */
export function floorplanEditorHref({ activityId, floorplanId }: { activityId?: string | null; floorplanId?: string | null }): string {
  const params = new URLSearchParams();
  if (floorplanId) params.set("open", floorplanId);
  if (activityId) params.set("activiteit", activityId);
  const query = params.toString();
  return query ? `/plattegrond-3d?${query}` : "/plattegrond-3d";
}

/**
 * De "Plattegrond"-kaart van een wizard-activiteit zonder 3D-weergave (de 3D-viewer zelf staat in PlattegrondSection):
 *
 *   - heeft de activiteit een 3D-plattegrond (alleen in de bewerkmodus bekend): thumbnail + "Plattegrond bewerken"
 *   - alleen een afbeelding: de afbeelding + "Vervang door 3D-plattegrond"
 *   - geen van beide: "Plattegrond maken"
 *
 * Zonder bewerkrecht (view-modus) verdwijnt de knop, en zonder beeld en zonder recht verdwijnt de kaart.
 * In de bewerkmodus kan het concept nog geen id hebben: `onOpenEditor` bewaart dan eerst en navigeert daarna.
 */
export function PlattegrondCard({
  imageUrl,
  floorplan = null,
  activityId,
  canEdit,
  onOpenEditor,
  dotClassName,
  animationDelay,
}: {
  imageUrl: string | null;
  /** 3D-plattegrond van de activiteit (alleen de bewerkmodus kent hem hier). */
  floorplan?: { id: string; previewUrl: string } | null;
  activityId?: string | null;
  canEdit: boolean;
  /** Bewerkmodus: bewaar het concept en open dan de editor. Zonder deze prop wordt een gewone link gebruikt. */
  onOpenEditor?: () => void | Promise<void>;
  dotClassName?: string;
  animationDelay?: string;
}) {
  const [busy, setBusy] = useState(false);

  if (!imageUrl && !floorplan && !canEdit) return null;

  const label = floorplan ? "Plattegrond bewerken" : imageUrl ? "Vervang door 3D-plattegrond" : "Plattegrond maken";
  const Icon = floorplan ? Pencil : imageUrl ? Box : Plus;
  const href = floorplanEditorHref({ activityId, floorplanId: floorplan?.id });

  async function handleClick() {
    if (!onOpenEditor) return;
    setBusy(true);
    try {
      await onOpenEditor();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-fade-up" style={animationDelay ? { animationDelay } : undefined} data-testid="plattegrond-kaart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={cn("size-2.5 shrink-0 rounded-[3px]", dotClassName ?? "bg-primary")} aria-hidden="true" />
          Plattegrond
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {floorplan ? (
          <div className="relative block h-48 w-full overflow-hidden rounded-2xl border bg-muted">
            <Image
              src={floorplan.previewUrl}
              alt="3D-plattegrond van het arrangement"
              fill
              sizes="(min-width: 768px) 700px, 100vw"
              className="object-contain"
            />
          </div>
        ) : imageUrl ? (
          <ActivityImageLightbox src={imageUrl} alt="Plattegrond van het arrangement" emptyLabel="Geen tekening toegevoegd." />
        ) : (
          <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground">
            <Box className="size-6" aria-hidden="true" />
            <p className="text-sm">Nog geen plattegrond</p>
          </div>
        )}
        {canEdit &&
          (onOpenEditor ? (
            <Button type="button" className="w-full sm:w-auto print:hidden" onClick={handleClick} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
              {label}
            </Button>
          ) : (
            <Button asChild variant={floorplan || imageUrl ? "outline" : "default"} className="w-full sm:w-auto print:hidden">
              <Link href={href}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
