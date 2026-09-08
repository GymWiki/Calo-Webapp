import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { SubmitActivityForm } from "./submit-activity-form";

export default async function ActiviteitIndienenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Bijdragen"
        title="Activiteit indienen"
        description="Elke inzending wordt automatisch gecontroleerd op kwaliteit en duplicaten. Goedgekeurde activiteiten verschijnen direct in de bibliotheek en tellen mee voor je maandelijkse quotum."
      />
      <SubmitActivityForm />
    </main>
  );
}
