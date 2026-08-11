import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { getAllActivities, getSavedActivityIds } from "@/lib/services/activities";
import { ActiviteitenSearchClient } from "./activiteiten-search-client";

export default function ZoekenPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Activiteiten"
        title="Ontdek activiteiten"
        description="Doorzoek de activiteiten-bibliotheek op trefwoord, leerlijn, doelgroep of materiaal."
      />
      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent />
      </Suspense>
    </main>
  );
}

async function ZoekenContent() {
  const [activities, profile] = await Promise.all([
    getAllActivities(),
    getCurrentUserProfile(),
  ]);

  const savedIds = profile
    ? await getSavedActivityIds(profile.id)
    : new Set<string>();

  return (
    <ActiviteitenSearchClient
      activities={activities}
      savedIds={Array.from(savedIds)}
    />
  );
}
