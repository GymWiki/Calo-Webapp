import { redirect } from "next/navigation";

import { OwnActivitiesSection } from "@/components/own-activities-section";
import { PageHeader } from "@/components/page-header";
import { getActivityDrafts, getOwnSubmissions } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielActiviteitenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Concepten (status 'draft') horen nu gewoon bij "Mijn activiteiten" —
  // hun status is al zichtbaar per item, dus een apart "Concepten"-blok is
  // niet meer nodig (zie ProfileNavGrid).
  const [submissions, drafts] = await Promise.all([
    getOwnSubmissions(profile.id),
    getActivityDrafts(profile.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Activiteiten"
        description="Al je activiteiten met status — alleen goedgekeurde, publieke activiteiten tellen mee voor je maandelijkse bijdrage."
      />
      <OwnActivitiesSection activities={[...drafts, ...submissions]} />
    </main>
  );
}
