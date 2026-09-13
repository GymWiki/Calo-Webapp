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

const FILE_INPUT_ID = "activity-import-file-input";

/**
 * Alternatieve invoerroute voor "Activiteit toevoegen": laat de gebruiker
 * een bestaande lesvoorbereiding uploaden i.p.v. alles handmatig over te
 * typen. Geen eigen formulier — geeft de geëxtraheerde data terug aan de
 * ouder, die daarmee het bestaande AddActivityStep-formulier vult.
 *
 * Meerdere eerdere pogingen (rechtstreekse Storage-upload, fetch() met
 * FormData, een Server Action met FormData) faalden allemaal identiek op
 * Android Chrome met "TypeError: Failed to fetch" — bevestigd via Vercel-
 * logs dat de aanvraag nooit ook maar het netwerk bereikte, op elke pagina
 * die dit component gebruikt (/les-maken én het voormalige
 * /activiteit-toevoegen), met elk bestand, ongeacht de servercode. Dat sluit
 * server-side oorzaken uit: het probleem zat dus in de browser, vóórdat de
 * aanvraag verstuurd wordt.
 *
 * Het enige overgebleven, nog niet geteste verschil met de wél werkende
 * Kennisbank-upload (KnowledgeUploadForm): dié gebruikt een gewoon,
 * zichtbaar `<input type="file">` dat de gebruiker rechtstreeks aantikt.
 * Dit component gebruikt een verborgen input die programmatisch geopend
 * werd via `ref.current.click()` vanuit een aparte knop — een JS-
 * gesimuleerde klik i.p.v. een echte, native klik op het formulierveld
 * zelf. Omgezet naar een `<label htmlFor>` die aan de (nog steeds verborgen)
 * input gekoppeld is: het aantikken van het label IS voor de browser een
 * native, vertrouwde interactie met de input, in tegenstelling tot een
 * script-aangeroepen .click(). Dat is nu het enige punt van verschil met de
 * bewezen werkende flow.
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
      // Tijdelijk (debug): ondanks alle eerdere aanpassingen bleef dezelfde
      // fout optreden, wéér zonder dat er iets in Vercel's logs verscheen —
      // dus opnieuw de ruwe fout tonen i.p.v. te gokken wat hem veroorzaakt.
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
          id={FILE_INPUT_ID}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button asChild variant="outline" className={isUploading ? "pointer-events-none opacity-50" : undefined}>
          <label htmlFor={FILE_INPUT_ID}>
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
          </label>
        </Button>
      </CardContent>
    </Card>
  );
}
