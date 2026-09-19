import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserPermissions, LIBRARY_PREVIEW_LIMIT } from "@/lib/permissions";
import { getAllActivities, getPublicActivities } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LibrarySearchClient } from "./library-search-client";

export default async function ZoekenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 xl:max-w-[1400px]">
      <PageHeader
        eyebrow="Bibliotheek"
        title="Ontdek activiteiten"
        description="GymWiki-activiteiten uit de gezamenlijke bibliotheek en publiek gedeelde activiteiten, in één doorzoekbaar overzicht."
      />

      {!hasFullLibraryAccess && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm">
              Je hebt de maandelijkse bijdrage-eis niet gehaald: je ziet hieronder een preview
              (de eerste {LIBRARY_PREVIEW_LIMIT} resultaten per filter/bron), maar het openen van
              een activiteit is geblokkeerd — behalve activiteiten die je zelf hebt bijgedragen.
              Draag deze maand een nieuwe activiteit bij of neem het betaalde abonnement voor
              volledige toegang tot de bibliotheek.
            </p>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent hasFullLibraryAccess={hasFullLibraryAccess} />
      </Suspense>
    </main>
  );
}

async function ZoekenContent({ hasFullLibraryAccess }: { hasFullLibraryAccess: boolean }) {
  // Preview-slot (zie de brief): een free_blocked-gebruiker krijgt dezelfde
  // volledige, doorzoekbare dataset als iedereen — de beperking zit niet in
  // wélke rijen worden opgehaald, maar in hoeveel kaarten LibrarySearchClient
  // ervan rendert (previewLimit) en in de blokkade bij het openen van een
  // activiteit (zie activiteit/[id]/page.tsx). Dat is bewust: het "kijk wat
  // je mist"-effect vereist dat de echte omvang van de bibliotheek zichtbaar
  // is, niet een vooraf al ingekorte dataset.
  const [activities, publicActivities] = await Promise.all([
    getAllActivities(),
    getPublicActivities(),
  ]);

  return (
    <LibrarySearchClient
      activities={activities}
      publicActivities={publicActivities}
      previewLimit={hasFullLibraryAccess ? null : LIBRARY_PREVIEW_LIMIT}
    />
  );
}
