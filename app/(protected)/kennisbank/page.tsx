import { redirect } from "next/navigation";

import { KnowledgeDocumentList } from "@/components/KnowledgeDocumentList";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { LescoachTestPanel } from "@/components/LescoachTestPanel";
import { PageHeader } from "@/components/page-header";
import { UserKnowledgeSections } from "@/components/UserKnowledgeSections";
import { getKnowledgeDocuments, getUserKnowledgeOverview } from "@/lib/services/knowledge";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const [{ defaults, own }, sharedDocuments] = await Promise.all([
    getUserKnowledgeOverview(profile.id),
    getKnowledgeDocuments(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Kennisbank"
        title="Kennisbank"
        description="Kies welke vakliteratuur en eigen documenten de AI Lescoach en Activiteiten Generator meenemen bij het genereren en beoordelen van lessen."
      />
      <UserKnowledgeSections defaultDocuments={defaults} ownDocuments={own} />

      <div className="space-y-8 border-t pt-8">
        <PageHeader
          eyebrow="Beheer"
          title="Standaard vakliteratuur beheren"
          description="Voeg gedeelde vakliteratuur toe of verwijder die — dit geldt voor alle gebruikers van GymWiki."
        />
        <KnowledgeUploadForm />
        <KnowledgeDocumentList documents={sharedDocuments} />
        <LescoachTestPanel />
      </div>
    </main>
  );
}
