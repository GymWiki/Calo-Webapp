import Link from "next/link";
import { redirect } from "next/navigation";
import { FileEdit, ListPlus } from "lucide-react";

import { ActivityDraftsList } from "@/components/profile/ActivityDraftsList";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getActivityDrafts } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielConceptenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const drafts = await getActivityDrafts(profile.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Concepten"
        description="Volledig ingevulde, nog niet ingediende activiteiten — dien ze in wanneer je klaar bent."
      />
      {drafts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="Geen concepten"
          description="Bewaar een activiteit als concept vanuit het toevoeg-formulier om 'm hier terug te vinden."
          action={
            <Button asChild>
              <Link href="/activiteit-toevoegen">
                <ListPlus className="size-4" />
                Activiteit toevoegen
              </Link>
            </Button>
          }
        />
      ) : (
        <ActivityDraftsList drafts={drafts} />
      )}
    </main>
  );
}
