import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserPermissions, LIBRARY_PREVIEW_LIMIT } from "@/lib/permissions";
import { getAllActivities, getPublicActivities } from "@/lib/services/activities";
import { getOrCreateLibraryPreviewActivityIds } from "@/lib/services/libraryPreview";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import type { UserProfile } from "@/lib/types";
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
              Je hebt de maandelijkse bijdrage-eis niet gehaald: dezelfde {LIBRARY_PREVIEW_LIMIT}{" "}
              activiteiten blijven voor jou vrij toegankelijk, ongeacht welke filters of zoektermen
              je toepast — de rest van de bibliotheek zie je vervaagd, met een slotje. Draag deze
              maand een nieuwe activiteit bij of neem het betaalde abonnement voor volledige
              toegang.
            </p>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent profile={profile} hasFullLibraryAccess={hasFullLibraryAccess} />
      </Suspense>
    </main>
  );
}

async function ZoekenContent({
  profile,
  hasFullLibraryAccess,
}: {
  profile: UserProfile;
  hasFullLibraryAccess: boolean;
}) {
  // Preview-slot (zie de brief): een free_blocked-gebruiker krijgt dezelfde
  // volledige, doorzoekbare dataset als iedereen — de beperking zit niet in
  // wélke rijen worden opgehaald, maar in welke kaarten LibrarySearchClient
  // als "vrij" i.p.v. vervaagd/vergrendeld rendert, en in de blokkade bij
  // het openen van een activiteit (zie activiteit/[id]/page.tsx). Dat is
  // bewust: het "kijk wat je mist"-effect vereist dat de echte omvang van
  // de bibliotheek zichtbaar blijft, niet een vooraf al ingekorte dataset.
  const [allActivities, publicActivities] = await Promise.all([
    getAllActivities(),
    getPublicActivities(),
  ]);

  // getAllActivities() geeft ALLE goedgekeurde+publieke activiteiten terug
  // (de basisbibliotheek ÉN door gebruikers gedeelde activiteiten) — de
  // "GymWiki"-bron-tab/badge hoort alleen bij de oorspronkelijke
  // basisbibliotheek (author_id null). Zonder dit filter zou een door een
  // gebruiker gedeelde activiteit hier dubbel én verkeerd gelabeld ("GymWiki"
  // i.p.v. "Publiek") verschijnen — 'm zit al correct in publicActivities
  // hieronder (zie getPublicActivities's eigen author_id-not-null-filter).
  const activities = allActivities.filter((activity) => activity.author_id === null);

  // Vaste preview-set (zie lib/services/libraryPreview.ts): eenmalig
  // berekend en op het profiel opgeslagen bij het eerste bezoek van een
  // free_blocked-gebruiker, zodat filteren niet steeds een NIEUWE N
  // oplevert — dat was precies de omzeiling die deze wijziging moest
  // dichten.
  const previewActivityIds = hasFullLibraryAccess
    ? null
    : await getOrCreateLibraryPreviewActivityIds(
        profile.id,
        profile.library_preview_activity_ids,
        [...new Set([...activities, ...publicActivities].map((activity) => activity.id))],
      );

  return (
    <LibrarySearchClient
      activities={activities}
      publicActivities={publicActivities}
      previewActivityIds={previewActivityIds}
      currentUserId={profile.id}
    />
  );
}
