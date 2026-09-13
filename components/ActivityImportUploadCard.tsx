"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
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

type ActionState = { error: string } | { success: true; activity: ExtractedActivity } | null;

/**
 * Alternatieve invoerroute voor "Activiteit toevoegen": laat de gebruiker
 * een bestaande lesvoorbereiding uploaden i.p.v. alles handmatig over te
 * typen. Geen eigen formulier — geeft de geëxtraheerde data terug aan de
 * ouder, die daarmee het bestaande AddActivityStep-formulier vult.
 *
 * DERDE herbouw van deze upload-flow. De eerste twee (rechtstreekse
 * fetch()-aanroep met FormData, en diezelfde aanroep via een Server Action)
 * faalden allebei identiek op Android Chrome met "TypeError: Failed to
 * fetch" — bevestigd via Vercel-logs dat de aanvraag nooit het netwerk
 * bereikte, op elke pagina die dit component gebruikt, met elk bestand,
 * ongeacht de servercode. Een derde poging (alleen de bestandskiezer-trigger
 * omzetten van een JS `ref.click()` naar een native `<label>`) loste het óók
 * niet op.
 *
 * Wat nog overbleef als verschil met de wél altijd werkende Kennisbank-
 * upload (KnowledgeUploadForm): die roept de Server Action niet
 * programmatisch aan vanuit een `input[type=file]`-onChange-handler direct
 * na het sluiten van de systeem-bestandenkiezer — het bestand kiezen en het
 * daadwerkelijk versturen zijn daar twee gescheiden, expliciete
 * gebruikersacties (kies bestand, vul het formulier in, tik pas dán op
 * "Toevoegen"). Deze upload-kaart deed dat in ÉÉN stap: de network-call
 * startte automatisch, meteen zodra de onChange van het (verborgen) bestands-
 * veld afging — dus zonder een verse, aparte tik van de gebruiker ná het
 * terugkeren van de systeem-bestandenkiezer. Android Chrome kan een net-
 * teruggekeerde, kort geleden naar de achtergrond geweest tab beperken in
 * het meteen zelf starten van nieuw netwerkverkeer zonder een tussenliggende
 * verse gebruikersinteractie.
 *
 * Nu herbouwd rond een ECHTE `<form action={...}>`-indiening (React 19's
 * useActionState, hetzelfde patroon als een klassieke formulier-POST i.p.v.
 * een handmatige FormData + async functie-aanroep) mét een aparte
 * "Uploaden"-knop: bestand kiezen vult alleen de bestandsnaam in, de
 * daadwerkelijke indiening gebeurt pas op een losse, verse tik — exact het
 * interactiepatroon van de Kennisbank-upload.
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
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  async function runExtraction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
    const result = await extractActivityFromUpload(formData);

    if ("error" in result) {
      toast.error(result.error);
      return result;
    }

    onExtracted(result.activity);
    setSelectedFileName(null);
    formRef.current?.reset();
    return result;
  }

  const [, formAction, isPending] = useActionState(runExtraction, null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFileName(event.target.files?.[0]?.name ?? null);
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
        <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            name="file"
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={isPending}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button type="submit" variant="outline" disabled={!selectedFileName || isPending}>
            {isPending ? (
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
