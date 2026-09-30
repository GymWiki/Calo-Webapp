"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageUp, Loader2, Pencil, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { getVideoImportFrameUrl, uploadManualReferenceFrame } from "@/actions/videoImport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "activity-video-imports";
const MANUAL_SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — ruim genoeg voor een schermafbeelding

type BannerStatus = "loading" | "no-frame" | "ready" | "error";

/**
 * STAP7-review: het voorgestelde overzichtsframe (AI-geselecteerd uit een
 * geüploade/gedownloade video, OF handmatig geüpload door de gebruiker —
 * zie DEEL3's transcript_only-fallback), met de 3 verplichte keuzes. Haalt
 * de signed URL pas op het moment dat deze banner daadwerkelijk gerenderd
 * wordt (niet vooraf bij job-voltooiing gecachet) — de gebruiker kan pas
 * veel later, na de rest van het formulier in te vullen, hierop klikken,
 * ruim voorbij de geldigheid van een eerder ondertekende URL.
 *
 * Toont, wanneer er nog geen frame is (transcript_only-modus heeft er
 * nooit automatisch een, en bij bestands-/full_auto-upload kan AI-
 * frame-selectie ook gewoon mislukken — STAP6-eis: dat dan duidelijk
 * tonen i.p.v. stilzwijgend niets), een eenvoudige schermafbeelding-
 * upload i.p.v. de banner helemaal te verbergen — zodra die geüpload is,
 * gedraagt de banner zich verder identiek aan een AI-voorstel.
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
  const [status, setStatus] = useState<BannerStatus>("loading");
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function refreshFrameUrl() {
    const result = await getVideoImportFrameUrl(jobId);
    if ("error" in result) {
      setStatus("error");
      return;
    }
    if (result.url) {
      setFrameUrl(result.url);
      setStatus("ready");
    } else {
      setStatus("no-frame");
    }
  }

  useEffect(() => {
    let cancelled = false;
    getVideoImportFrameUrl(jobId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
      } else if (result.url) {
        setFrameUrl(result.url);
        setStatus("ready");
      } else {
        setStatus("no-frame");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function handleManualFrameSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Alleen JPEG- of PNG-afbeeldingen worden ondersteund.");
      return;
    }
    if (file.size > MANUAL_SCREENSHOT_MAX_BYTES) {
      toast.error(`Afbeelding is te groot (max ${Math.round(MANUAL_SCREENSHOT_MAX_BYTES / 1024 / 1024)}MB).`);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Je bent niet ingelogd.");
        return;
      }

      const extension = file.type === "image/png" ? "png" : "jpg";
      const storagePath = `${user.id}/${jobId}/manual-frame.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        console.error("VideoFrameReviewBanner: schermafbeelding-upload mislukt:", uploadError.message);
        toast.error("Uploaden is mislukt. Probeer het opnieuw.");
        return;
      }

      const result = await uploadManualReferenceFrame(jobId, storagePath);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      await refreshFrameUrl();
    } finally {
      setUploading(false);
    }
  }

  if (status === "error" || status === "loading") {
    return status === "loading" ? (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    ) : null;
  }

  if (status === "no-frame") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Arrangement-afbeelding</CardTitle>
          <CardDescription>
            We kunnen geen beeld uit deze video halen. Heb je een moment waarop de opstelling goed te
            zien is? Maak daar een schermafbeelding van en upload die hieronder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
              Schermafbeelding uploaden
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleManualFrameSelected}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard} disabled={uploading}>
              <X className="size-4" />
              Niet gebruiken
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Overzichtsframe</CardTitle>
        <CardDescription>
          Dit beeld lijkt een goed startpunt voor de arrangement-afbeelding. Wat wil je ermee doen?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative h-40 w-full overflow-hidden rounded-lg border bg-muted sm:w-64">
          {frameUrl && (
            <Image src={frameUrl} alt="Voorgesteld overzichtsframe" fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!frameUrl} onClick={() => frameUrl && onUseDirectly(frameUrl)}>
            <Upload className="size-4" />
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
