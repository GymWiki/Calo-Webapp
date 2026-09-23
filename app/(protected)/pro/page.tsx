import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ReturnToAppBanner } from "@/components/mobile/ReturnToAppBanner";
import { SubscriptionPlansSection } from "@/components/subscription/SubscriptionPlansSection";
import { getUserPermissions } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

const SUBSCRIPTION_FEATURES = [
  "Altijd volledige toegang tot de activiteitenbibliotheek",
  "Geen maandelijkse bijdrage-eis",
  "Zelf activiteiten blijven delen mag altijd, maar is niet verplicht",
];

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; native?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { checkout, native } = await searchParams;
  // Alleen tonen als deze pagina via de systeem-browser-link vanuit de
  // native app is geopend (zie NativeUpgradeAction) — een gewone
  // webgebruiker die per ongeluk ?native=1 in de URL heeft staan ziet dit
  // ook, maar de link is een no-op deeplink zonder geïnstalleerde app, dus
  // onschadelijk.
  const returnBanner =
    native === "1" && (checkout === "success" || checkout === "cancelled") ? (
      <ReturnToAppBanner status={checkout} />
    ) : null;

  const isPaid = getUserPermissions(profile).subscriptionStatus === "paid_subscriber";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow={isPaid ? "Abonnement" : "GymWiki-abonnement"}
        title={isPaid ? "Je hebt volledige toegang" : "Volledige toegang zonder bijdrage-eis"}
        description={
          isPaid
            ? "Bedankt voor je steun aan GymWiki — je hebt altijd volledige toegang tot de bibliotheek, zonder bijdrage-eis."
            : "GymWiki is gratis zolang je maandelijks minstens 4 activiteiten bijdraagt aan de bibliotheek. Liever geen bijdrage-eis? Kies een van de opties hieronder."
        }
      />

      {returnBanner}

      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {SUBSCRIPTION_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {feature}
          </li>
        ))}
      </ul>

      <SubscriptionPlansSection currentType={profile.subscription_type} />

      {isPaid && profile.subscription_type !== "lifetime" && (
        <p className="text-center text-sm text-muted-foreground">
          Je abonnement wordt automatisch verlengd via Stripe. Opzeggen kan op elk moment via je
          Stripe-facturatieportaal.
        </p>
      )}
    </main>
  );
}
