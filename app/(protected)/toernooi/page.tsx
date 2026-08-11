import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { TournamentClient } from "./tournament-client";

export default async function ToernooiPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Toernooi Generator"
        title="Genereer een speelschema"
        description="Stel je teams en velden in en krijg binnen een minuut een eerlijk, gebalanceerd wedstrijdschema."
      />
      <TournamentClient />
    </main>
  );
}
