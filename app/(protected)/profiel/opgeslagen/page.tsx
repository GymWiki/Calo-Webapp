import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LibraryItemCard, type LibraryListItem } from "@/components/library-item-card";
import { PageHeader } from "@/components/page-header";
import { getSavedActivities } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielOpgeslagenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const activities = await getSavedActivities(profile.id);
  const items: LibraryListItem[] = activities.map((activity) => ({
    source: "gymwiki" as const,
    id: activity.id,
    activity,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Opgeslagen activiteiten"
        description="Je favoriete activiteiten uit de bibliotheek."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nog geen activiteiten opgeslagen"
          description="Sla activiteiten op vanuit de bibliotheek om ze hier snel terug te vinden."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <LibraryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
