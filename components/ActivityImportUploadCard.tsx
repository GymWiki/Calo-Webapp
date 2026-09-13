"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
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
 * Laat de gebruiker een bestaande lesvoorbereiding uploaden i.p.v. alles
 * handmatig over te typen. Geen eigen formulier — geeft de geëxtraheerde
 * data terug aan de ouder (activity-upload-step.tsx), die daarmee het
 * gewone lesformulier (LessonForm) vult.
 *
 * VIERDE herbouw van deze upload-flow. Eerdere pogingen (fetch() met
 * FormData, dezelfde aanroep via een Server Action, alleen de bestands-
 * kiezer-trigger aangepast) faalden allemaal identiek op Android Chrome met
 * "TypeError: Failed to fetch" — bevestigd dat de aanvraag nooit het
 * netwerk bereikte, op elke pagina, met elk bestand, ongeacht de
 * servercode.
 *
 * Een poging om het interactiepatroon te laten matchen met de wél altijd
 * werkende Kennisbank-upload (bestand kiezen en versturen als twee
 * gescheiden acties) gebruikte `<form action={...}>` (React 19's
 * useActionState) — dat gaf een ANDERE, veelzeggende fout: Chrome's eigen
 * "This page couldn't load" netwerkfout-pagina, met de hele /les-maken-URL
 * die probeerde te herladen. Dat betekent dat de formulier-indiening NIET
 * door React onderschept werd en de browser een ECHTE, native, paginavolle
 * form-POST deed — precies het gedrag dat je NOOIT wilt bij een Server
 * Action-aanroep vanuit JS. `<form action={fn}>` leunt volledig op React om
 * de submit te onderscheppen; als dat om wat voor reden dan ook niet gebeurt
 * (bv. bij een net-teruggekeerde, kort geleden naar de achtergrond geweest
 * tab, of een wankele verbinding), valt de browser terug op een gewone
 * pagina-navigatie — die dan faalt zodra de verbinding niet perfect is.
 *
 * Kennisbank's KnowledgeUploadForm loopt hier NOOIT tegenaan, want die roept
 * `event.preventDefault()` synchroon aan in een gewone `onSubmit`-handler —
 * dat blokkeert een native form-submissie altijd en onvoorwaardelijk, in
 * tegenstelling tot het "action"-prop-mechanisme dat op React's eigen
 * onderschepping vertrouwt. Dit bestand is nu teruggebracht naar exact dat
 * bewezen patroon: een gewone `<form onSubmit>` met `preventDefault()`,
 * gecombineerd met de gescheiden "kies bestand, tik dan pas op Uploaden"-
 * interactie uit de vorige poging.
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const result = await extractActivityFromUpload(formData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onExtracted(result.activity);
      setSelectedFile(null);
      event.currentTarget.reset();
    } catch (cause) {
      console.error("ActivityImportUploadCard: onverwachte fout:", cause);
      const detail =
        cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      toast.error(`Verwerken van dit bestand is mislukt. (${detail})`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Upload een bestaande activiteit</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={isUploading}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button type="submit" variant="outline" disabled={!selectedFile || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Bestand wordt geanalyseerd...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Uploaden
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
