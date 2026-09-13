"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { extractActivityFromUpload } from "@/actions/activityImport";
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
 * Stuurt het bestand via een Server Action (extractActivityFromUpload,
 * actions/activityImport.ts) i.p.v. een fetch()-aanroep naar een eigen
 * /api-route. Twee eerdere pogingen faalden allebei op productie (Android
 * Chrome, "TypeError: Failed to fetch", bevestigd via Vercel-logs die voor
 * deze route nooit ook maar één binnenkomend request lieten zien):
 * eerst een rechtstreekse browser-upload naar Supabase Storage, daarna een
 * gewone same-origin fetch() met FormData. Uiteindelijk bleek, door het te
 * vergelijken met andere AI-aanroepen op dezelfde pagina op hetzelfde
 * toestel, dat specifiek de combinatie fetch()+FormData-met-een-echt-
 * File-object het probleem was (fetch() zonder bestand werkte wel; een
 * FormData-upload mét bestand via een Server Action, zoals de Kennisbank-
 * upload, werkte ook wel). Server Actions gebruiken React's eigen
 * formulier-actie-protocol, dat de browser's oudere, robuustere native
 * form-encoding voor bestanden gebruikt in plaats van fetch()'s eigen
 * Blob/File-leeslogica.
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

      const result = await extractActivityFromUpload(formData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onExtracted(result.activity);
    } catch (cause) {
      console.error("ActivityImportUploadCard: onverwachte fout:", cause);
      // Tijdelijk (debug): ondanks de overstap naar een Server Action bleef
      // dezelfde generieke fout optreden, wéér zonder dat er ook maar iets in
      // Vercel's logs verscheen — dus opnieuw de ruwe fout tonen i.p.v. te
      // gokken wat hem veroorzaakt (zie STAP 3 van eerdere iteraties).
      const detail =
        cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      toast.error(`Verwerken van dit bestand is mislukt. (${detail})`);
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
