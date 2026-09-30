import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { YOUTUBE_IMPORT_MODE } from "@/lib/ai/youtubeImportMode";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

/**
 * Intern, admin-only overzicht van de "Activiteit uit video" AI-
 * importinstellingen — met name de YOUTUBE_IMPORT_MODE-schakelaar (zie
 * lib/ai/youtubeImportMode.ts voor de volledige juridische afweging). Puur
 * informatief: de modus zelf wisselt alleen via de omgevingsvariabele +
 * herdeploy, niet via deze pagina — het doel hier is UITSLUITEND de
 * zichtbare disclaimer wanneer 'full_auto' actief staat (DEEL4-eis: "niet
 * naar de eindgebruiker", dus achter dezelfde isLibraryAdmin-gate als
 * /beheer/taalcheck).
 */
export default async function AiImportBeheerPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isLibraryAdmin(profile.email)) {
    redirect("/dashboard");
  }

  const isFullAuto = YOUTUBE_IMPORT_MODE === "full_auto";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Beheer · AI-import"
        title="YouTube-importinstellingen"
        description="Toont de actief geconfigureerde modus voor de YouTube-linkinvoer bij 'Activiteit uit video'."
      />

      <Card className={isFullAuto ? "border-destructive/50 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isFullAuto ? (
              <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
            )}
            Actieve modus: <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{YOUTUBE_IMPORT_MODE}</code>
          </CardTitle>
          <CardDescription>
            Ingesteld via de omgevingsvariabele <code>YOUTUBE_IMPORT_MODE</code> — wijzigen vereist een
            herdeploy, niet instelbaar via deze pagina of door eindgebruikers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isFullAuto ? (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <p className="font-semibold text-destructive">Let op: juridisch risico actief</p>
              <p>
                In <code>full_auto</code>-modus downloadt GymWiki server-side de volledige video van een
                door een gebruiker geplakte YouTube-link, om audio en frames te extraheren. Dit is in
                strijd met YouTube&apos;s Terms of Service (§ &quot;Permissions and Restrictions&quot; verbiedt
                downloaden buiten een door YouTube aangeboden downloadknop om), ongeacht dat de content
                zelf publiek toegankelijk is. Handhaving hiervan door YouTube wisselt sterk (van nooit tot
                account-/API-sancties) — dit is een bewuste, per-bedrijf risico-afweging, geen technisch
                besluit. Zet dit alleen aan na expliciete, bewuste goedkeuring hiervan.
              </p>
              <p>
                Zet <code>YOUTUBE_IMPORT_MODE=transcript_only</code> (of laat de omgevingsvariabele weg —
                dat is de standaardwaarde) om terug te schakelen naar het veilige pad: alleen de
                al-gepubliceerde ondertiteling ophalen, nooit de video zelf downloaden.
              </p>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">Veilige modus actief</p>
              <p>
                In <code>transcript_only</code>-modus haalt GymWiki alleen de al-gepubliceerde
                ondertiteling van een YouTube-video op — nooit een download van de video zelf. Gebruikers
                krijgen bij deze modus een handmatige schermafbeelding-upload aangeboden voor de
                arrangement-afbeelding, in plaats van een automatisch geëxtraheerd videoframe.
              </p>
            </div>
          )}
          <p className="text-muted-foreground">
            Zie de toelichting in <code>lib/ai/youtubeImportMode.ts</code> voor de volledige afweging
            achter deze schakelaar.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
