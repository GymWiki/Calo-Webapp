import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { TaalcheckReviewAdmin } from "@/components/TaalcheckReviewAdmin";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { getTaalcheckVoorstellen } from "@/lib/services/taalcheck";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

/**
 * Intern, admin-only review-overzicht voor taalcheck-voorstellen (zie
 * supabase/migrations/activiteiten_taalcheck.sql) — toont per voorstel
 * origineel vs. voorgesteld naast elkaar en laat een admin goedkeuren/
 * afwijzen vóórdat er iets naar de live activiteiten-tabel wordt
 * geschreven. Gegated op isLibraryAdmin, net als /kennisbank/beheer — RLS
 * (is_library_admin() in de migratie) is de echte handhaving.
 */
export default async function TaalcheckBeheerPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isLibraryAdmin(profile.email)) {
    redirect("/dashboard");
  }

  const voorstellen = await getTaalcheckVoorstellen(["pending"]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Beheer · Taalcheck"
        title="Taalcheck-voorstellen beoordelen"
        description="AI-voorstellen voor spelling, grammatica en onduidelijke formuleringen in bestaande activiteiten. Niets wordt overschreven totdat je een voorstel goedkeurt en de wijzigingen toepast."
      />
      <TaalcheckReviewAdmin voorstellen={voorstellen} />
    </main>
  );
}
