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
 *
 * Stuurt het bestand rechtstreeks (same-origin FormData) naar onze eigen
 * /api-route. Een eerdere versie liet de browser eerst rechtstreeks naar
 * Supabase Storage uploaden (om Vercel's 4,5MB-request-limiet te omzeilen
 * voor grote bestanden) — maar dat introduceerde een nieuwe, ergere bug:
 * Supabase's eigen edge-logs lieten zien dat de CORS-preflight (OPTIONS)
 * steevast slaagde, maar de daadwerkelijke upload nooit volgde, óók niet
 * voor een bestand van maar 122 KB (dus ver onder elke size-limiet). De
 * simpele, bewezen same-origin route (die niet afhankelijk is van een
 * cross-origin browser-upload naar Supabase) is teruggezet; zie
 * DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES in de route voor hoe de 4,5MB-
 * platformlimiet nu wordt afgehandeld (een duidelijke foutmelding i.p.v.
 * een crash, i.p.v. de complexere maar kennelijk onbetrouwbare omweg).
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
    } catch (cause) {
      console.error("ActivityImportUploadCard: onverwachte fout:", cause);
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
