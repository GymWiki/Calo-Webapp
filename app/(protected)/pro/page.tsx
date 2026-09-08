import { redirect } from "next/navigation";
import { Check, CircleCheck } from "lucide-react";

import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getUserPermissions } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

const SUBSCRIPTION_FEATURES = [
  "Altijd volledige toegang tot de activiteitenbibliotheek",
  "Geen maandelijkse bijdrage-eis",
  "Zelf activiteiten blijven delen mag altijd, maar is niet verplicht",
];

export default async function ProPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (getUserPermissions(profile).subscriptionStatus === "paid_subscriber") {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Abonnement"
          title="Je hebt een actief abonnement"
          description="Bedankt voor je steun aan GymWiki — je hebt altijd volledige toegang tot de bibliotheek, zonder bijdrage-eis."
        />
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CircleCheck className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Je abonnement wordt maandelijks automatisch verlengd via Stripe. Opzeggen kan op elk
              moment via je Stripe-facturatieportaal.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="GymWiki-abonnement"
        title="Volledige toegang zonder bijdrage-eis"
        description="GymWiki is gratis zolang je maandelijks minstens 4 activiteiten bijdraagt aan de bibliotheek. Liever geen bijdrage-eis? Neem het abonnement."
      />

      <Card>
        <CardContent className="space-y-6 py-6">
          <div>
            <span className="text-3xl font-bold tracking-tight">EUR 3,- /mnd</span>
            <p className="mt-1 text-sm text-muted-foreground">
              Op elk moment opzegbaar. Geen verplichting om zelf activiteiten toe te voegen.
            </p>
          </div>

          <ul className="space-y-2">
            {SUBSCRIPTION_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>

          <ProCheckoutButton className="w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
