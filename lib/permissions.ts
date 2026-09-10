import type { SubscriptionStatus, UserProfile } from "@/lib/types";

// Vlak fair-use-quotum voor de AI Lescoach/Activiteiten Generator — geen
// tiers meer, geldt voor iedereen (free_contributor, free_blocked én
// paid_subscriber) gelijk. Losgekoppeld van het abonnementsmodel: dit is
// puur een kostenbeheersing tegen misbruik van de OpenAI-integratie, geen
// betaalfunctie.
export const MONTHLY_AI_LIMIT = 40;

// Dedicated fair-use-limiet voor de AI-lessengenerator (/api/ai/generate-
// activity) — losstaand van MONTHLY_AI_LIMIT hierboven, want deze functie
// heeft sinds de kostenbeheersing-taak een eigen toegangsmodel: alleen
// paid_subscriber-accounts, met dit eigen maandquotum. Zie
// lib/ai/lessonGeneratorAccess.ts.
export const LESSON_GENERATOR_MONTHLY_LIMIT = 25;

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
