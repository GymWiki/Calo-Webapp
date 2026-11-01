import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SubscriptionPlansSection } from "@/components/subscription/SubscriptionPlansSection";
import { Card, CardContent } from "@/components/ui/card";
import { MONTHLY_CONTRIBUTION_REQUIRED_COUNT, type SubscriptionPlan } from "@/lib/constants/subscriptionPlans";
import { getUserPermissions } from "@/lib/permissions";
import { hasActiveEntitlement, manageTarget, type EntitlementRow } from "@/lib/subscription/entitlement";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";

const SUBSCRIPTION_FEATURES = [
  "Altijd volledige toegang tot de activiteitenbibliotheek",
  "Geen maandelijkse bijdrage-eis",
  "Zelf activiteiten blijven delen mag altijd, maar is niet verplicht",
];

function isSubscriptionPlan(value: string | undefined): value is SubscriptionPlan {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { plan } = await searchParams;
  // ?plan= komt van de prijskaarten op de landingspagina (app/page.tsx) via
  // /register — puur visuele nadruk (web), geen automatische checkout.
  const highlightPlan = isSubscriptionPlan(plan) ? plan : undefined;

  // Waar loopt het abonnement? Kolommen bestaan pas na
  // supabase/migrations/entitlements_multi_source.sql; een fout = geen rij →
  // terugval op het bestaande profiel (Stripe).
  const supabase = createClient(await cookies());
  const { data: row } = await supabase
    .from("subscriptions")
    .select("source, status, expires_at, subscription_type")
    .eq("user_id", profile.id)
    .maybeSingle();
  const paidByProfile = getUserPermissions(profile).subscriptionStatus === "paid_subscriber";
  const entitlement = {
    active: row ? hasActiveEntitlement(row as EntitlementRow) || paidByProfile : paidByProfile,
    manage: row ? manageTarget(row as EntitlementRow) : paidByProfile ? ("stripe-portal" as const) : ("none" as const),
  };

  const isPaid = getUserPermissions(profile).subscriptionStatus === "paid_subscriber";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow={isPaid ? "Abonnement" : "GymWiki-abonnement"}
        title={isPaid ? "Je hebt volledige toegang" : "Volledige toegang zonder bijdrage-eis"}
        description={
          isPaid
            ? "Bedankt voor je steun aan GymWiki — je hebt altijd volledige toegang tot de bibliotheek, zonder bijdrage-eis."
            : `GymWiki is gratis zolang je maandelijks minstens ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten bijdraagt aan de bibliotheek. Liever geen bijdrage-eis? Kies een van de opties hieronder.`
        }
      />

      {profile.team_id && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm">
            Je hebt volledige toegang via het team <span className="font-semibold">{profile.team_name}</span>
            {profile.team_role === "owner" ? " (je bent eigenaar)" : ""} — geen eigen abonnement nodig. Beheer
            je team via{" "}
            <Link href="/profiel/team" className="font-medium text-primary underline-offset-4 hover:underline">
              Profiel → Team
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {SUBSCRIPTION_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {feature}
          </li>
        ))}
      </ul>

      <SubscriptionPlansSection
        currentType={profile.subscription_type}
        highlightPlan={highlightPlan}
        userId={profile.id}
        entitlement={entitlement}
      />

      {isPaid && profile.subscription_type !== "lifetime" && entitlement.manage === "stripe-portal" && (
        <p className="text-center text-sm text-muted-foreground">
          Je abonnement wordt automatisch verlengd via Stripe. Opzeggen kan op elk moment via je
          Stripe-facturatieportaal.
        </p>
      )}
    </main>
  );
}
