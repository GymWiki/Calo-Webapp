import { redirect } from "next/navigation";

import { KnowledgeDocumentList } from "@/components/KnowledgeDocumentList";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { PageHeader } from "@/components/page-header";
import { getAllKnowledgeDocuments } from "@/lib/services/knowledge";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const documents = await getAllKnowledgeDocuments();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Kennisbank"
        title="Kennisbank"
        description="Upload artikelen en documenten — deze vormen samen de kennisbasis voor de AI Activiteitenchecker en de AI Activiteitengenerator."
      />
      <KnowledgeUploadForm />
      <KnowledgeDocumentList documents={documents} currentUserId={profile.id} />
    </main>
  );
}
