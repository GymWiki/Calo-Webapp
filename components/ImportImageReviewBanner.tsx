"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, X } from "lucide-react";

import { getActivityImportImageUrls } from "@/actions/activityImport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type BannerStatus = "loading" | "ready" | "empty" | "error";

/**
 * Toont de uit het geüploade document gehaalde afbeeldingen (plattegronden,
 * foto's — zie lib/ai/documentNormalization.ts's extractAttachments en
 * activityImportProcessor.ts se uploadExtractedImages) zodat de gebruiker er
 * één als natekenreferentie voor de plattegrond-tekenaar kan kiezen. Haalt de
 * signed URL's pas op het moment dat de banner daadwerkelijk rendert (niet
 * vooraf bij job-voltooiing gecachet) — de gebruiker kan pas veel later, na
 * de rest van het formulier in te vullen, hierop klikken, ruim voorbij de
 * geldigheid van een eerder ondertekende URL.
 */
export function ImportImageReviewBanner({
  jobId,
  onUseAsBackground,
  onDiscard,
}: {
  jobId: string;
  onUseAsBackground: (imageUrl: string) => void;
  onDiscard: () => void;
}) {
  const [status, setStatus] = useState<BannerStatus>("loading");
  const [images, setImages] = useState<{ storagePath: string; url: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActivityImportImageUrls(jobId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
        return;
      }
      if (result.images.length === 0) {
        setStatus("empty");
        return;
      }
      setImages(result.images);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (status === "loading") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || status === "empty") {
    return null;
  }

  return (
    <Card className="animate-fade-up border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Afbeeldingen uit het document</CardTitle>
        <CardDescription>
          Dit document bevatte {images.length === 1 ? "een afbeelding" : `${images.length} afbeeldingen`} — wil
          je er één gebruiken als natekenreferentie voor de plattegrond?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {images.map((image) => (
            <div key={image.storagePath} className="flex flex-col gap-1.5">
              <div className="relative h-28 w-40 overflow-hidden rounded-lg border bg-muted">
                <Image src={image.url} alt="" fill className="object-cover" unoptimized />
              </div>
              <Button type="button" size="sm" onClick={() => onUseAsBackground(image.url)}>
                Gebruik als achtergrond
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
          <X className="size-4" />
          Niet gebruiken
        </Button>
      </CardContent>
    </Card>
  );
}
