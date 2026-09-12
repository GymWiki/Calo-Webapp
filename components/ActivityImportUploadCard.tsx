"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { createClient } from "@/utils/supabase/client";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

const BUCKET = "kennisbank-documenten";

/**
 * Alternatieve invoerroute voor "Activiteit toevoegen": laat de gebruiker
 * een bestaande lesvoorbereiding uploaden i.p.v. alles handmatig over te
 * typen. Geen eigen formulier — geeft de geëxtraheerde data terug aan de
 * ouder, die daarmee het bestaande AddActivityForm vult (zie add-activity-
 * form.tsx). Optioneel: het handmatige formulier blijft altijd gewoon
 * bruikbaar zonder dit ooit te gebruiken.
 */
const DEFAULT_DESCRIPTION =
  "PDF, Word (.docx), PowerPoint (.pptx) of tekstbestand — de AI zet het om naar het " +
  "formulier hieronder, zodat je het alleen nog hoeft te controleren vóór je indient. " +
  "Liever alles zelf intypen? Dat kan ook gewoon, hieronder.";

export function ActivityImportUploadCard({
  onExtracted,
  description = DEFAULT_DESCRIPTION,
}: {
  onExtracted: (activity: ExtractedActivity) => void;
  description?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Het bestand gaat rechtstreeks van de browser naar Supabase Storage
      // — NIET via onze eigen /api-route. Vercel Functions weigeren elke
      // request-body boven 4,5 MB (een harde platformlimiet, niet
      // instelbaar); een rauwe lesvoorbereiding van een paar MB liep daar
      // al tegenaan, nog vóór de route-code ooit draaide. De route krijgt
      // hierna alleen het (kleine) opslagpad en haalt het bestand zelf op.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Je bent niet ingelogd.");
        return;
      }

      const path = `${user.id}/activiteit-import/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        toast.error("Uploaden is mislukt. Probeer het opnieuw.");
        return;
      }

      const response = await fetch("/api/ai/extract-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, fileType: file.type }),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "Verwerken van dit bestand is mislukt.");
        return;
      }

      onExtracted(data.activity as ExtractedActivity);
    } catch {
      toast.error("Verwerken van dit bestand is mislukt. Probeer het opnieuw.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Upload een bestaande lesvoorbereiding</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Bestand wordt geanalyseerd...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Kies bestand
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
