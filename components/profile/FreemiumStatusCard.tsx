import Link from "next/link";
import { CircleCheck, CreditCard, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContributionStatus } from "@/lib/services/contribution";
import type { SubscriptionStatus } from "@/lib/types";

function daysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

/**
 * Uitgebreide freemium-statuskaart voor de profielhub — dezelfde
 * ContributionStatus-data als de compactere dashboard-banner
 * (ContributionStatusCard), maar met een voortgangsbalk en resterende
 * dagen deze maand erbij. Bewust een los component (niet hergebruikt op
 * het dashboard) zodat die banner niet meeverandert.
 */
export function FreemiumStatusCard({
  status,
  subscriptionStatus,
}: {
  status: ContributionStatus;
  subscriptionStatus: SubscriptionStatus;
}) {
  if (!status.required) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Betaald abonnee — EUR 3,-/mnd</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Altijd volledige toegang tot de bibliotheek, geen bijdrage-eis.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/pro">
              <CreditCard className="size-4" />
              Abonnement beheren
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.min(
    100,
    Math.round((status.approvedCount / status.requiredCount) * 100),
  );
  const daysLeft = daysRemainingInMonth();

  return (
    <Card className={subscriptionStatus === "free_blocked" ? "border-destructive/40 bg-destructive/5" : status.met ? "border-success/40 bg-success/5" : undefined}>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={
                status.met
                  ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                  : "flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              }
            >
              {status.met ? (
                <CircleCheck className="size-5" />
              ) : (
                <TriangleAlert className="size-4.5" />
              )}
            </div>
            <div>
              <p className="font-semibold">Gratis account — via bijdragen</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {status.approvedCount} van {status.requiredCount} activiteiten deze maand — nog{" "}
                {daysLeft} {daysLeft === 1 ? "dag" : "dagen"} in deze maand.
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/pro">Upgrade naar betaald</Link>
          </Button>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={
              status.met
                ? "h-full rounded-full bg-success transition-all duration-300 ease-brand"
                : "h-full rounded-full bg-primary transition-all duration-300 ease-brand"
            }
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
