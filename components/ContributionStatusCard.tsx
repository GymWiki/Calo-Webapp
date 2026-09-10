import Link from "next/link";
import { CircleCheck, Lock, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContributionStatus } from "@/lib/services/contribution";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Dashboardwidget die de maandelijkse bijdrage-eis toont (freemium-model,
 * vervangt de oude XP/level-kaart). Betaalde abonnees zien een korte
 * bevestiging zonder quotum; free_blocked-accounts krijgen een duidelijke
 * waarschuwing + upsell naar het betaalde abonnement.
 */
export function ContributionStatusCard({
  status,
  subscriptionStatus,
}: {
  status: ContributionStatus;
  subscriptionStatus: SubscriptionStatus;
}) {
  if (!status.required) {
    return (
      <Card className="animate-fade-up border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Betaald abonnement actief</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Volledige toegang tot de activiteitenbibliotheek — geen bijdrage-eis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (subscriptionStatus === "free_blocked") {
    return (
      <Card className="animate-fade-up border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Lock className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Bibliotheektoegang beperkt</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Vorige maand had je niet genoeg bijdragen ({status.approvedCount}/
                {status.requiredCount}). Draag deze maand {status.requiredCount} nieuwe
                activiteiten of zelfgemaakte lessen bij, of neem het betaalde abonnement voor
                onbeperkte toegang.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild size="sm">
              <Link href="/les-maken">Activiteit toevoegen</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/pro">Abonnement</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const remaining = Math.max(status.requiredCount - status.approvedCount, 0);
  const met = status.met;

  return (
    <Card className={met ? "animate-fade-up border-success/40 bg-success/5" : "animate-fade-up"}>
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={
              met
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                : "flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            }
          >
            {met ? <CircleCheck className="size-5" /> : <TriangleAlert className="size-4.5" />}
          </div>
          <div>
            <p className="font-semibold">
              {status.approvedCount}/{status.requiredCount} bijdragen deze maand goedgekeurd
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {met
                ? "Je voldoet aan de maandelijkse bijdrage-eis — de bibliotheek blijft volledig toegankelijk."
                : `Nog ${remaining} ${remaining === 1 ? "bijdrage" : "bijdragen"} nodig deze maand om volledige toegang te behouden.`}
            </p>
          </div>
        </div>
        {!met && (
          <Button asChild size="sm" className="shrink-0">
            <Link href="/les-maken">Activiteit toevoegen</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
