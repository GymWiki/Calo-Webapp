import { redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { AvailableForInternshipToggle } from "@/components/profile/AvailableForInternshipToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielInstellingenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Accountinstellingen"
        description="Beheer je gegevens en voorkeuren."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contactgegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{profile.email ?? "Geen e-mailadres bekend"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voorkeuren</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailableForInternshipToggle initialValue={profile.available_for_internship} />
        </CardContent>
      </Card>
    </main>
  );
}
