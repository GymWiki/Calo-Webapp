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
 * voor grote bestanden) — maar dat introduceerde een nieuwe, ergere bug en
 * is teruggedraaid naar deze simpele, bewezen same-origin route.
 *
 * De hardnekkige "Verwerken van dit bestand is mislukt" die daarna nog
 * bleef optreden bleek, bevestigd via een echte test op een mobiel
 * toestel, helemaal geen library-/serverbug: de browser gaf
 * "TypeError: Failed to fetch" — de generieke melding voor een aanvraag
 * die het netwerk niet eens haalt, meestal door geen/wankele
 * internetverbinding op dat moment. Vercel's logs bevestigden dit: er kwam
 * bij geen enkele van deze pogingen ook maar iets bij de server binnen.
 * Verwarrend was dat de rest van de (PWA-gecachete) pagina wél leek te
 * werken — een GET-navigatie valt bij Workbox terug op cache, een POST
 * zoals deze upload niet, dus die faalt zichtbaar zodra de verbinding
 * wegvalt terwijl de rest van de site "gewoon werkt" (uit cache). Vandaar
 * de navigator.onLine-check en de specifieke netwerk-foutmelding hieronder.
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

    // Bevestigd via een echte test op een mobiel toestel: de meest
    // voorkomende faalmodus hier is helemaal geen bug, maar een
    // ontbrekende/wankele internetverbinding op het moment van uploaden —
    // de browser geeft dat als "TypeError: Failed to fetch". Deze app is
    // een PWA die pagina's cachet, dus de rest van de site kan dan alsnog
    // prima lijken te werken (uit cache) terwijl een upload, die geen
    // cache-terugval heeft, gewoon hard faalt. Vang het vooraf af met een
    // duidelijke melding i.p.v. de gebruiker te laten gokken.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Geen internetverbinding. Controleer je verbinding en probeer het opnieuw.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/ai/extract-activity", {
        method: "POST",
        body: formData,
      });

      // Ruwe tekst eerst lezen i.p.v. direct response.json(): als de server
      // (of iets ertussenin, zoals een platform-timeout-pagina) geen geldige
      // JSON teruggeeft, willen we die ruwe inhoud kunnen loggen/tonen i.p.v.
      // gewoon in de catch hieronder te belanden zonder enig aanknopingspunt.
      const rawBody = await response.text();
      let data: { error?: string; activity?: ExtractedActivity };
      try {
        data = JSON.parse(rawBody);
      } catch {
        console.error(
          "ActivityImportUploadCard: response is geen geldige JSON. Status:",
          response.status,
          "Body:",
          rawBody.slice(0, 500),
        );
        toast.error(
          `Verwerken van dit bestand is mislukt. (HTTP ${response.status}, geen geldige respons)`,
        );
        return;
      }

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "Verwerken van dit bestand is mislukt.");
        return;
      }

      onExtracted(data.activity as ExtractedActivity);
    } catch (cause) {
      console.error("ActivityImportUploadCard: onverwachte fout:", cause);
      // "TypeError: Failed to fetch" is de browser-generieke melding voor
      // "de aanvraag kon het netwerk niet eens op" — bevestigd (via een
      // echte test) de daadwerkelijke, meest voorkomende oorzaak hier, dus
      // die krijgt een eigen, herkenbare melding i.p.v. de generieke tekst.
      const isNetworkError = cause instanceof TypeError && /fetch/i.test(cause.message);
      toast.error(
        isNetworkError
          ? "Geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw."
          : "Verwerken van dit bestand is mislukt. Probeer het opnieuw.",
      );
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
