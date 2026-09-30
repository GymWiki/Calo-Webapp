"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Pencil, X } from "lucide-react";

import { getVideoImportFrameUrl } from "@/actions/videoImport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * STAP7-review: het door de AI voorgestelde overzichtsframe uit de
 * geüploade video, met de 3 verplichte keuzes. Haalt de signed URL pas op
 * het moment dat deze banner daadwerkelijk gerenderd wordt (niet vooraf bij
 * job-voltooiing gecachet) — de gebruiker kan pas veel later, na de rest
 * van het formulier in te vullen, hierop klikken, ruim voorbij de geldigheid
 * van een eerder ondertekende URL.
 */
export function VideoFrameReviewBanner({
  jobId,
  onUseDirectly,
  onOpenInEditor,
  onDiscard,
}: {
  jobId: string;
  onUseDirectly: (frameUrl: string) => void;
  onOpenInEditor: (frameUrl: string) => void;
  onDiscard: () => void;
}) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVideoImportFrameUrl(jobId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setFrameUrl(result.url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Overzichtsframe uit je video</CardTitle>
        <CardDescription>
          Dit frame uit je video lijkt een goed startpunt voor de arrangement-afbeelding. Wat wil je
          ermee doen?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative h-40 w-full overflow-hidden rounded-lg border bg-muted sm:w-64">
          {frameUrl ? (
            <Image src={frameUrl} alt="Voorgesteld overzichtsframe" fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!frameUrl} onClick={() => frameUrl && onUseDirectly(frameUrl)}>
            Gebruiken als arrangement-afbeelding
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!frameUrl}
            onClick={() => frameUrl && onOpenInEditor(frameUrl)}
          >
            <Pencil className="size-4" />
            Zelf aanpassen in de canvas-editor
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            <X className="size-4" />
            Niet gebruiken
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compacte melding voor wanneer frame-selectie is mislukt of geen enkel
 * frame bruikbaar bleek (STAP6-eis: dan geen afbeelding voorstellen i.p.v.
 * een ongeschikt frame te forceren) — duidelijk aan de gebruiker getoond
 * i.p.v. stilzwijgend niets te tonen.
 */
export function VideoFrameUnavailableNotice() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <ImageOff className="size-4 shrink-0" aria-hidden="true" />
      Er is geen bruikbaar overzichtsframe gevonden in deze video. Je kunt de plattegrond hieronder
      alsnog zelf tekenen.
    </div>
  );
}
