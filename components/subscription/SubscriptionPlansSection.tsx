"use client";

import { NativeUpgradeAction } from "@/components/mobile/NativeUpgradeAction";
import { PlanCard } from "@/components/subscription/PlanCard";
import { ProCheckoutButton } from "@/components/subscription/ProCheckoutButton";
import {
  PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_ORDER,
  type SubscriptionPlan,
} from "@/lib/constants/subscriptionPlans";
import { useIsNativeApp } from "@/lib/mobile/useIsNativeApp";
import type { SubscriptionType } from "@/lib/types";

/**
 * Client component: enige plek die native-vs-web bepaalt voor de hele
 * prijskaarten-sectie. Web: elke koopbare kaart krijgt zijn eigen
 * ProCheckoutButton. Native: de kaarten blijven puur informatief (prijs/
 * besparing vergelijken mag altijd) maar krijgen GEEN losse koop-knop per
 * kaart — dat zou 3x dezelfde systeem-browser-link betekenen. In plaats
 * daarvan staat er ÉÉN gedeelde NativeUpgradeAction onder de kaarten (zie
 * components/mobile/NativeUpgradeAction.tsx): de native app mag sowieso
 * nooit een ingebedde Stripe-checkout tonen, dus welke kaart je in de app
 * zelf bekijkt is decoratief — de daadwerkelijke keuze + betaling gebeurt
 * op gymwiki.nl in de systeem-browser (zie app/(protected)/pro/page.tsx
 * voor de bijbehorende ReturnToAppBanner die daarna weer terugleidt).
 */
export function SubscriptionPlansSection({
  currentType,
  highlightPlan,
}: {
  currentType: SubscriptionType;
  /** Komt vanuit /pro?plan=... (zie app/(protected)/pro/page.tsx) — een gebruiker die
   * op de landingspagina een specifiek plan koos en zich net registreerde. */
  highlightPlan?: SubscriptionPlan;
}) {
  const isNative = useIsNativeApp();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {SUBSCRIPTION_PLAN_ORDER.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];
          const isCurrent = currentType === planId;
          // Downgraden (bv. lifetime -> maandelijks) wordt bewust niet als
          // koopoptie aangeboden — zie de toelichting in
          // app/api/stripe/create-checkout/route.ts, die dit ook server-
          // side afdwingt.
          const isDowngrade =
            currentType !== "none" && !isCurrent && PLAN_ORDER[planId] < PLAN_ORDER[currentType];

          return (
            <PlanCard
              key={planId}
              plan={plan}
              isCurrent={isCurrent}
              highlighted={highlightPlan === planId}
              action={
                isDowngrade ? (
                  <p className="text-center text-xs text-muted-foreground">Niet beschikbaar als downgrade</p>
                ) : isNative ? null : (
                  <ProCheckoutButton
                    plan={planId}
                    label={plan.mode === "payment" ? "Eenmalig afrekenen" : "Abonneren"}
                    className="w-full"
                  />
                )
              }
            />
          );
        })}
      </div>

      {/* Lifetime-gebruikers zien geen upgrade-actie meer, ongeacht platform
          — hun kaart toont al "Je huidige plan" en alle andere kaarten
          "Niet beschikbaar als downgrade", dus deze knop zou toch nergens
          heen kunnen leiden. */}
      {isNative && currentType !== "lifetime" && <NativeUpgradeAction />}
    </div>
  );
}
