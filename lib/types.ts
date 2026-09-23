export type SubscriptionStatus = "free_contributor" | "free_blocked" | "paid_subscriber";

/**
 * Welk betaald plan — los van subscription_status hierboven, dat de enige
 * bron van waarheid voor toegangscontrole blijft (lib/permissions.ts kijkt
 * hier NIET naar: een lifetime-koper krijgt gewoon subscription_status =
 * 'paid_subscriber', exact als een maand-/jaarabonnee). Puur voor weergave
 * (welke kaart is "je huidige plan" op /pro) en het upgrade-pad in
 * app/api/stripe/create-checkout/route.ts. 'none' voor gratis accounts.
 */
export type SubscriptionType = "none" | "monthly" | "yearly" | "lifetime";

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  subscription_status: SubscriptionStatus;
  subscription_type: SubscriptionType;
  email: string | null;
  /**
   * Vaste preview-set voor de bibliotheek (/zoeken) — alleen relevant voor
   * free_blocked-accounts. null = nog nooit berekend (zie
   * getOrCreateLibraryPreviewActivityIds); daarna een vaste lijst van
   * activiteit-ID's die ongeacht filters "vrij" blijven. Zie
   * supabase/migrations/library_preview_activity_ids.sql.
   */
  library_preview_activity_ids: string[] | null;
};
