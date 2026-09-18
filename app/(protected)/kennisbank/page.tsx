import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { KnowledgeDocumentList } from "@/components/KnowledgeDocumentList";
import { KnowledgePackageList } from "@/components/KnowledgePackageList";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { getAllKnowledgeDocuments } from "@/lib/services/knowledge";
import { getActivePackagesWithPreferences } from "@/lib/services/knowledgePackages";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

// Eigen documenten en Standaardbibliotheek zijn twee onafhankelijke
// databronnen die voorheen samen in één Promise.all vóór alle JSX stonden
// — de tab-shell (en dus ook de altijd-zichtbare "eigen"-tab) wachtte
// daardoor mee op de "standaard"-query. Elke tab-inhoud krijgt nu zijn
// eigen Suspense-boundary zodat ze onafhankelijk van elkaar streamen.
export default async function KennisbankPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          eyebrow="Kennisbank"
          title="Kennisbank"
          description="Vakliteratuur voor de AI Activiteitenchecker en AI Lescoach — je eigen uploads en de door GymWiki beheerde Standaardbibliotheek."
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

        <TabsContent value="eigen">
          {/* Op mobiel/tablet gestapeld (formulier eerst, dan de lijst); vanaf
              lg genoeg breedte voor het uploadformulier als vaste
              linkerkolom naast de documentenlijst. */}
          <div className="grid gap-6 lg:grid-cols-[26rem_1fr] lg:items-start lg:gap-8">
            <KnowledgeUploadForm />
            <Suspense
              fallback={
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              }
            >
              <OwnDocumentsSection userId={profile.id} />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent value="standaard" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Door GymWiki samengestelde literatuurpakketten. Zet een pakket aan om het mee te
            nemen in jouw AI-context, naast je eigen documenten hierboven.
          </p>
          <Suspense
            fallback={
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            }
          >
            <StandardLibrarySection userId={profile.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </main>
  );
}

async function OwnDocumentsSection({ userId }: { userId: string }) {
  const documents = await getAllKnowledgeDocuments();
  return <KnowledgeDocumentList documents={documents} currentUserId={userId} />;
}

async function StandardLibrarySection({ userId }: { userId: string }) {
  const packages = await getActivePackagesWithPreferences(userId);
  return <KnowledgePackageList packages={packages} />;
}
