import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { AvailableForInternshipToggle } from "@/components/profile/AvailableForInternshipToggle";
import { HolidayRegionSelect } from "@/components/profile/HolidayRegionSelect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { manageTarget, type EntitlementRow } from "@/lib/subscription/entitlement";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";

export default async function ProfielInstellingenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Waar loopt het abonnement? (kolommen bestaan pas na de entitlements-migratie;
  // een fout levert gewoon geen rij op en dan vallen we terug op Stripe.)
  const supabase = createClient(await cookies());
  const { data: entitlement } = await supabase
    .from("subscriptions")
    .select("source, status, expires_at, subscription_type")
    .eq("user_id", profile.id)
    .maybeSingle();
  const manage = entitlement
    ? manageTarget(entitlement as EntitlementRow)
    : profile.subscription_status === "paid_subscriber"
      ? "stripe-portal"
      : "none";

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
        <CardContent className="space-y-3">
          <AvailableForInternshipToggle initialValue={profile.available_for_internship} />
          <HolidayRegionSelect initialValue={profile.holiday_region} />
          <ThemeToggle />
        </CardContent>
      </Card>

      <DeleteAccountCard manage={manage} />
    </main>
  );
}
