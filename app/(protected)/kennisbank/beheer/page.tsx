import { redirect } from "next/navigation";

import { KnowledgeLibraryAdmin } from "@/components/KnowledgeLibraryAdmin";
import { PageHeader } from "@/components/page-header";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { getAllPackagesWithDocuments } from "@/lib/services/knowledgePackages";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

/**
 * Stap 9: intern, admin-only overzicht van alle Standaardbibliotheek-
 * pakketten/documenten + hun verwerkingsstatus, zodat mislukte verwerkingen
 * zichtbaar en opnieuw te starten zijn zonder in de database te graven.
 * Gegated op isLibraryAdmin (geen rollensysteem in dit project, zie
 * lib/adminAccess.ts) — RLS (is_library_admin() in knowledge_packages.sql)
 * is de echte handhaving; deze redirect is puur voor een nette UX.
 */
export default async function KennisbankBeheerPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isLibraryAdmin(profile.email)) {
    redirect("/kennisbank");
  }

  const packages = await getAllPackagesWithDocuments();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Kennisbank · Beheer"
        title="Standaardbibliotheek beheren"
        description="Pakketten en documenten voor de door GymWiki beheerde literatuurbibliotheek. Zichtbaar/aanzetbaar voor gebruikers alleen wanneer een pakket actief is."
      />
      <KnowledgeLibraryAdmin packages={packages} />
    </main>
  );
}
