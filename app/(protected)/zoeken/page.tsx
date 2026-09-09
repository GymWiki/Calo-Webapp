import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserPermissions } from "@/lib/permissions";
import { getAllActivities, getOwnSubmissions } from "@/lib/services/activities";
import { getPublicLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LibrarySearchClient } from "./library-search-client";

export default async function ZoekenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Bibliotheek"
        title="Ontdek activiteiten & lessen"
        description="GymWiki-activiteiten uit de gezamenlijke bibliotheek en publiek gedeelde lesvoorbereidingen, in één doorzoekbaar overzicht."
      />

      {!hasFullLibraryAccess && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm">
              Je hebt de maandelijkse bijdrage-eis niet gehaald, dus zie je bij
              GymWiki-activiteiten hieronder alleen je eigen bijdragen. Publiek gedeelde lessen
              blijven wel gewoon zichtbaar. Dien deze maand nieuwe activiteiten in of neem het
              betaalde abonnement voor volledige toegang tot de activiteitenbibliotheek.
            </p>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent userId={profile.id} hasFullLibraryAccess={hasFullLibraryAccess} />
      </Suspense>
    </main>
  );
}

async function ZoekenContent({
  userId,
  hasFullLibraryAccess,
}: {
  userId: string;
  hasFullLibraryAccess: boolean;
}) {
  const [activities, lessons] = await Promise.all([
    hasFullLibraryAccess ? getAllActivities() : getOwnSubmissions(userId),
    getPublicLessons(),
  ]);

  return <LibrarySearchClient activities={activities} lessons={lessons} />;
}
