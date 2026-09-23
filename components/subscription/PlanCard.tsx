import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubscriptionPlanInfo } from "@/lib/constants/subscriptionPlans";

/**
 * Puur presentationeel — geen hooks, dus vrij te importeren vanuit zowel
 * server- als client-code. De koop-knop/actie komt van de aanroeper via
 * `action` (children-achtig slot): web-gebruikers krijgen een
 * ProCheckoutButton, native-app-gebruikers zien de kaarten juist zonder
 * losse actie (één gedeelde NativeUpgradeAction eronder) — zie
 * SubscriptionPlansSection.tsx.
 */
export function PlanCard({
  plan,
  isCurrent,
  action,
}: {
  plan: SubscriptionPlanInfo;
  isCurrent: boolean;
  action: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col",
        plan.recommended && !isCurrent && "border-primary/50 shadow-md",
        isCurrent && "border-success/40 bg-success/5",
      )}
    >
      {plan.recommended && !isCurrent && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Meest gekozen</Badge>
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
