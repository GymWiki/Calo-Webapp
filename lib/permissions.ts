import type { SubscriptionStatus, UserProfile } from "@/lib/types";

// Vlak fair-use-quotum voor AI-functies zonder eigen dedicated limiet — geen
// tiers meer, geldt voor iedereen (free_contributor, free_blocked én
// paid_subscriber) gelijk. Losgekoppeld van het abonnementsmodel: dit is
// puur een kostenbeheersing tegen misbruik van de OpenAI-integratie, geen
// betaalfunctie.
export const MONTHLY_AI_LIMIT = 40;

// Eigen fair-use-limiet voor AI Lescoach (/api/ai/analyze-lesson) — alleen
// paid_subscriber-accounts, met een EIGEN, HOGER quotum dan MONTHLY_AI_LIMIT
// hierboven: Lescoach raadpleegt men naar verwachting meerdere keren PER
// activiteit terwijl die groeit (iteratief, per sectie). 60: ruim voldoende
// voor herhaald gebruik binnen één activiteit-sessie, terwijl gpt-4o-mini
// (zie CHECK_MODEL) de kosten per aanroep al laag houdt — bijstellen zodra
// er echte gebruiksdata in `ai_usage` staat (feature='ai_lescoach'). Zie
// lib/ai/lescoachAccess.ts.
export const AI_LESCOACH_MONTHLY_LIMIT = 60;

export interface UserPermissions {
  subscriptionStatus: SubscriptionStatus;
  /**
   * false alleen voor free_blocked-accounts: gratis gebruikers die de
   * maandelijkse bijdrage-eis (4 goedgekeurde activiteiten) niet hebben
   * gehaald. Zij zien in de bibliotheek alleen hun eigen bijdragen totdat
   * ze weer bijdragen of het betaalde abonnement nemen.
   */
  hasFullLibraryAccess: boolean;
  monthlyAiLimit: number;
}

/**
 * Centrale bron van waarheid voor bibliotheektoegang. Accepteert een los
 * getypeerd profiel (volledig UserProfile, een partial select met alleen
 * `subscription_status`, of null/undefined voor een uitgelogde bezoeker).
 */
export function getUserPermissions(
  profile: Pick<UserProfile, "subscription_status"> | null | undefined,
): UserPermissions {
  const subscriptionStatus = profile?.subscription_status || "free_contributor";

  return {
    subscriptionStatus,
    hasFullLibraryAccess: subscriptionStatus !== "free_blocked",
    monthlyAiLimit: MONTHLY_AI_LIMIT,
  };
}
