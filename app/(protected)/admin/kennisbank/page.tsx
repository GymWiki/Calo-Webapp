import { redirect } from "next/navigation";

import { KnowledgeDocumentList } from "@/components/KnowledgeDocumentList";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { LescoachTestPanel } from "@/components/LescoachTestPanel";
import { PageHeader } from "@/components/page-header";
import { getKnowledgeDocuments } from "@/lib/services/knowledge";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Defense in depth alongside proxy.ts's route gate.
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const documents = await getKnowledgeDocuments();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Beheer"
        title="Kennisbank"
        description="Upload didactische vakliteratuur zodat de AI Lescoach en Activiteiten Generator hun antwoorden hierop kunnen baseren."
      />

      <KnowledgeUploadForm />
      <KnowledgeDocumentList documents={documents} />
      <LescoachTestPanel />
    </main>
  );
}
