import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlanCardInfo } from "@/lib/constants/subscriptionPlans";

/**
 * Puur presentationeel — geen hooks, dus vrij te importeren vanuit zowel
 * server- als client-code (o.a. de server-gerenderde prijzensectie op
 * app/page.tsx). De koop-knop/actie komt van de aanroeper via `action`
 * (children-achtig slot): web-gebruikers krijgen een ProCheckoutButton,
 * native-app-gebruikers zien de kaarten juist zonder losse actie (één
 * gedeelde NativeUpgradeAction eronder, zie SubscriptionPlansSection.tsx),
 * en op de landingspagina is `action` altijd een gewone /register-link.
 * `plan: PlanCardInfo` (niet het bredere SubscriptionPlanInfo) zodat ook
 * het niet-koopbare gratis-plan (FREE_PLAN_INFO) dezelfde kaart gebruikt.
 */
export function PlanCard({
  plan,
  isCurrent = false,
  highlighted = false,
  action,
}: {
  plan: PlanCardInfo;
  isCurrent?: boolean;
  /** Tijdelijke visuele nadruk — zie /pro's ?plan=-parameter (vanuit register). */
  highlighted?: boolean;
  action: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col",
        plan.recommended && !isCurrent && "border-primary/50 shadow-md",
        isCurrent && "border-success/40 bg-success/5",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {plan.recommended && !isCurrent && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          {plan.badgeLabel ?? "Meest gekozen"}
        </Badge>
      )}

      <CardContent className="flex flex-1 flex-col gap-4 py-6">
        <div>
          <p className="font-semibold">{plan.label}</p>
          <p className="mt-1">
            <span className="text-2xl font-bold tracking-tight">{plan.priceLabel}</span>{" "}
            <span className="text-sm text-muted-foreground">{plan.periodLabel}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        </div>

        {plan.savingsLabel && (
          <p className="flex items-start gap-1.5 text-sm font-medium text-success">
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            {plan.savingsLabel}
          </p>
        )}

        <div className="mt-auto pt-2">
          {isCurrent ? (
            <div className="flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 py-2 text-sm font-medium text-success">
              <CircleCheck className="size-4" />
              Je huidige plan
            </div>
          ) : (
            action
          )}
        </div>
      </CardContent>
    </Card>
  );
}
