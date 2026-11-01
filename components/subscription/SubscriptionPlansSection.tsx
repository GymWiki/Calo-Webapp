"use client";

import { useEffect, useState } from "react";

import { PlanCard } from "@/components/subscription/PlanCard";
import { ProCheckoutButton } from "@/components/subscription/ProCheckoutButton";
import { StorePaywall } from "@/components/subscription/StorePaywall";
import {
  PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_ORDER,
  type SubscriptionPlan,
} from "@/lib/constants/subscriptionPlans";
import { useIsNativeApp } from "@/lib/mobile/useIsNativeApp";
import { MANAGE_URLS, type ManageTarget } from "@/lib/subscription/entitlement";
import type { SubscriptionType } from "@/lib/types";

export interface PlansEntitlement {
  /** Heeft de gebruiker nu volledige betaalde toegang (elke bron)? */
  active: boolean;
  /** Waar het abonnement loopt. */
  manage: ManageTarget;
}

/**
 * Enige plek die native-vs-web bepaalt voor de prijssectie.
 *
 * Web: prijskaarten met Stripe-checkout — tenzij het abonnement al via een
 * store loopt (dan verwijzen we naar het beheren daar; nooit dubbel betalen).
 *
 * Native (iOS/Android): GEEN Stripe, geen link naar de website en geen
 * verwijzing naar andere prijzen (Apple 3.1.1). Wie nog niet betaalt ziet de
 * store-paywall; wie al betaalt ziet alleen een statusbericht.
 */
export function SubscriptionPlansSection({
  currentType,
  highlightPlan,
  userId,
  entitlement,
}: {
  currentType: SubscriptionType;
  /** Komt vanuit /pro?plan=... — alleen visuele nadruk op het web. */
  highlightPlan?: SubscriptionPlan;
  userId: string;
  entitlement: PlansEntitlement;
}) {
  const isNative = useIsNativeApp();
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (!isNative) return;
    void import("@capacitor/core").then(({ Capacitor }) => {
      const p = Capacitor.getPlatform();
      if (p === "ios" || p === "android") setPlatform(p);
    });
  }, [isNative]);

  const viaStore = entitlement.manage === "app-store" || entitlement.manage === "google-play";

  if (isNative) {
    if (entitlement.active) {
      const storeName = entitlement.manage === "app-store" ? "de App Store" : entitlement.manage === "google-play" ? "Google Play" : null;
      return (
        <div className="space-y-2 rounded-xl border p-4 text-center text-sm" data-testid="native-subscription-status">
          {currentType === "lifetime" ? (
            <p>Je hebt volledige toegang, zonder einddatum.</p>
          ) : storeName ? (
            <>
              <p>Je hebt volledige toegang. Je abonnement loopt via {storeName}.</p>
              <a
                href={entitlement.manage === "app-store" ? MANAGE_URLS["app-store"] : MANAGE_URLS["google-play"]}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Abonnement beheren in {storeName}
              </a>
            </>
          ) : (
            <p>Je hebt volledige toegang. Je abonnement loopt via de website.</p>
          )}
        </div>
      );
    }
    if (!platform) return null;
    return <StorePaywall userId={userId} platform={platform} />;
  }

  if (viaStore && entitlement.active) {
    return (
      <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground" data-testid="web-store-subscription">
        Je abonnement loopt via de {entitlement.manage === "app-store" ? "App Store" : "Google Play"}. Beheren of
        opzeggen doe je in de GymWiki-app of in de instellingen van je {entitlement.manage === "app-store" ? "Apple" : "Google"}-account.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SUBSCRIPTION_PLAN_ORDER.map((planId) => {
        const plan = SUBSCRIPTION_PLANS[planId];
        const isCurrent = currentType === planId;
        const isDowngrade = currentType !== "none" && !isCurrent && PLAN_ORDER[planId] < PLAN_ORDER[currentType];

        return (
          <PlanCard
            key={planId}
            plan={plan}
            isCurrent={isCurrent}
            highlighted={highlightPlan === planId}
            action={
              isDowngrade ? (
                <p className="text-center text-xs text-muted-foreground">Niet beschikbaar als downgrade</p>
              ) : (
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
  );
}
