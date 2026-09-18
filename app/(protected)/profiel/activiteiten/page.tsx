import { redirect } from "next/navigation";

import { OwnActivitiesSection } from "@/components/own-activities-section";
import { PageHeader } from "@/components/page-header";
import { getActivityDrafts, getOwnSubmissions } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielActiviteitenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { tab } = await searchParams;
  const defaultTab = tab === "activiteiten" ? "activiteiten" : "concepten";

  // Concepten (status 'draft') en daadwerkelijk opgeslagen activiteiten
  // staan in aparte tabbladen (zie OwnActivitiesSection) — consistent met
  // het "Eigen documenten"/"Standaardbibliotheek"-patroon op /kennisbank.
  const [submissions, drafts] = await Promise.all([
    getOwnSubmissions(profile.id),
    getActivityDrafts(profile.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Profiel"
        title="Activiteiten"
        description="Al je activiteiten met status — alleen gedeelde, goedgekeurde activiteiten tellen mee voor je maandelijkse bijdrage."
      />
      <OwnActivitiesSection drafts={drafts} submissions={submissions} defaultTab={defaultTab} />
    </main>
  );
}
