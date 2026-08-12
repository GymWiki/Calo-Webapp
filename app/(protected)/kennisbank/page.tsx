import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { UserKnowledgeSections } from "@/components/UserKnowledgeSections";
import { getUserKnowledgeOverview } from "@/lib/services/knowledge";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { defaults, own } = await getUserKnowledgeOverview(profile.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Mijn Kennisbank"
        title="Kennisbank"
        description="Kies welke vakliteratuur en eigen documenten de AI Lescoach en Activiteiten Generator meenemen bij het genereren en beoordelen van lessen."
      />
      <UserKnowledgeSections defaultDocuments={defaults} ownDocuments={own} />
    </main>
  );
}
