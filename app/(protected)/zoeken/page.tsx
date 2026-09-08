import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserPermissions } from "@/lib/permissions";
import { getAllActivities, getOwnSubmissions } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { ActiviteitenSearchClient } from "./activiteiten-search-client";

export default async function ZoekenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Activiteiten"
        title="Ontdek activiteiten"
        description="Doorzoek de activiteiten-bibliotheek op trefwoord, leerlijn, doelgroep of materiaal."
      />

      {!hasFullLibraryAccess && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm">
              Je hebt de maandelijkse bijdrage-eis niet gehaald, dus zie je hieronder alleen je
              eigen bijdragen. Dien deze maand nieuwe activiteiten in of neem het betaalde
              abonnement voor volledige toegang tot de bibliotheek.
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
  const activities = hasFullLibraryAccess
    ? await getAllActivities()
    : await getOwnSubmissions(userId);

  return <ActiviteitenSearchClient activities={activities} />;
}
