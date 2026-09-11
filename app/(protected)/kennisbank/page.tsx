import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { KnowledgeDocumentList } from "@/components/KnowledgeDocumentList";
import { KnowledgePackageList } from "@/components/KnowledgePackageList";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { getAllKnowledgeDocuments } from "@/lib/services/knowledge";
import { getActivePackagesWithPreferences } from "@/lib/services/knowledgePackages";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const [documents, packages] = await Promise.all([
    getAllKnowledgeDocuments(),
    getActivePackagesWithPreferences(profile.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          eyebrow="Kennisbank"
          title="Kennisbank"
          description="Vakliteratuur voor de AI Activiteitenchecker, AI Lescoach en AI Activiteitengenerator — je eigen uploads en de door GymWiki beheerde Standaardbibliotheek."
        />
        {isLibraryAdmin(profile.email) && (
          <Link
            href="/kennisbank/beheer"
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" />
            Beheer
          </Link>
        )}
      </div>

      <Tabs defaultValue="eigen">
        <TabsList>
          <TabsTrigger value="eigen">Eigen documenten</TabsTrigger>
          <TabsTrigger value="standaard">Standaardbibliotheek</TabsTrigger>
        </TabsList>

        <TabsContent value="eigen" className="space-y-8">
          <KnowledgeUploadForm />
          <KnowledgeDocumentList documents={documents} currentUserId={profile.id} />
        </TabsContent>

        <TabsContent value="standaard" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Door GymWiki samengestelde literatuurpakketten. Zet een pakket aan om het mee te
            nemen in jouw AI-context, naast je eigen documenten hierboven.
          </p>
          <KnowledgePackageList packages={packages} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
