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

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

/**
 * Alternatieve invoerroute voor "Activiteit toevoegen": laat de gebruiker
 * een bestaande lesvoorbereiding uploaden i.p.v. alles handmatig over te
 * typen. Geen eigen formulier — geeft de geëxtraheerde data terug aan de
 * ouder, die daarmee het bestaande AddActivityForm vult (zie add-activity-
 * form.tsx). Optioneel: het handmatige formulier blijft altijd gewoon
 * bruikbaar zonder dit ooit te gebruiken.
 */
export function ActivityImportUploadCard({
  onExtracted,
}: {
  onExtracted: (activity: ExtractedActivity) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/ai/extract-activity", {
        method: "POST",
        body: formData,
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
        <CardDescription>
          PDF, Word (.docx), PowerPoint (.pptx) of tekstbestand — de AI zet het om naar het
          formulier hieronder, zodat je het alleen nog hoeft te controleren vóór je indient.
          Liever alles zelf intypen? Dat kan ook gewoon, hieronder.
        </CardDescription>
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
