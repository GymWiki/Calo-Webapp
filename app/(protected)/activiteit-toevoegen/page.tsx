import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { AddActivityForm } from "./add-activity-form";

export default async function ActiviteitToevoegenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Toevoegen"
        title="Activiteit toevoegen"
        description="Je activiteit wordt direct toegevoegd — onze AI controleert 'm op de achtergrond op kwaliteit en duplicaten. Goedgekeurde activiteiten blijven zichtbaar in de bibliotheek en tellen mee voor je maandelijkse bijdrage."
      />
      <AddActivityForm />
    </main>
  );
}
