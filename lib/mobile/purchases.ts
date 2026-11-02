// Dunne laag om RevenueCat (Apple IAP / Google Play Billing) — alleen in de
// native app gebruiken. Dynamische import: @revenuecat/purchases-capacitor
// komt zo nooit in de bundel van webbezoekers (CLAUDE.md: code-splitting).
// Prijzen en proefperiode komen ALTIJD uit de store (priceString/introPrice),
// nooit hardcoded; productnamen: docs/store-products.md.

import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

export type StorePlanId = "monthly" | "yearly";

export interface StoreOffer {
  id: StorePlanId;
  /** Kant-en-klare, gelokaliseerde prijs uit de store, bv. "€ 3,00". */
  priceString: string;
  /** Aantal dagen gratis proef als de gebruiker daarvoor in aanmerking komt, anders 0. */
  trialDays: number;
  pkg: PurchasesPackage;
}

export type PurchaseResult = "purchased" | "cancelled" | "error";

let configuredFor: string | null = null;

async function purchases() {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases;
}

/** Koppelt RevenueCat aan het Supabase-account (app user id = Supabase user id). Idempotent. */
export async function identify(userId: string): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  const platform = Capacitor.getPlatform();
  const apiKey = platform === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY : platform === "android" ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY : undefined;
  if (!apiKey) return false;
  const p = await purchases();
  if (configuredFor === null) {
    await p.configure({ apiKey, appUserID: userId });
  } else if (configuredFor !== userId) {
    await p.logIn({ appUserID: userId });
  }
  configuredFor = userId;
  return true;
}

function planOf(pkg: PurchasesPackage): StorePlanId | null {
  if (pkg.packageType === "MONTHLY") return "monthly";
  if (pkg.packageType === "ANNUAL") return "yearly";
  return null;
}

/** Haalt het huidige aanbod op (offering "default") met per plan prijs en proefstatus. */
export async function loadOffers(): Promise<StoreOffer[]> {
  const p = await purchases();
  const { Capacitor } = await import("@capacitor/core");
  const offerings = await p.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];

  // iOS: RevenueCat kan eligibility bepalen; Android: store-sheet toont de echte voorwaarden,
  // we tonen de proef alleen als het product een gratis fase heeft én (iOS) eligible is.
  let eligible: Record<string, { status: number }> = {};
  if (Capacitor.getPlatform() === "ios") {
    try {
      eligible = (await p.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: packages.map((x) => x.product.identifier) })) as unknown as Record<string, { status: number }>;
    } catch {
      eligible = {};
    }
  }

  const offers: StoreOffer[] = [];
  for (const pkg of packages) {
    const id = planOf(pkg);
    if (!id) continue;
    const free = pkg.product.introPrice && pkg.product.introPrice.price === 0 ? pkg.product.introPrice : null;
    const status = eligible[pkg.product.identifier]?.status;
    // INTRO_ELIGIBILITY_STATUS_ELIGIBLE === 2
    const iosOk = Capacitor.getPlatform() !== "ios" || status === 2;
    const days = free && iosOk ? daysOf(free.periodUnit, free.periodNumberOfUnits, free.cycles) : 0;
    offers.push({ id, priceString: pkg.product.priceString, trialDays: days, pkg });
  }
  return offers.sort((a, b) => (a.id === b.id ? 0 : a.id === "monthly" ? -1 : 1));
}

function daysOf(unit: string, count: number, cycles: number): number {
  const per = unit === "DAY" ? 1 : unit === "WEEK" ? 7 : unit === "MONTH" ? 30 : unit === "YEAR" ? 365 : 0;
  return per * count * Math.max(cycles, 1);
}

export async function purchase(offer: StoreOffer): Promise<PurchaseResult> {
  const p = await purchases();
  try {
    await p.purchasePackage({ aPackage: offer.pkg });
    return "purchased";
  } catch (error) {
    return (error as { userCancelled?: boolean })?.userCancelled ? "cancelled" : "error";
  }
}

/** Verplicht ("Aankopen herstellen"). */
export async function restore(): Promise<"restored" | "nothing" | "error"> {
  const p = await purchases();
  try {
    const { customerInfo } = await p.restorePurchases();
    return Object.keys(customerInfo.entitlements.active).length > 0 ? "restored" : "nothing";
  } catch {
    return "error";
  }
}
