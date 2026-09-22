export type SubscriptionStatus = "free_contributor" | "free_blocked" | "paid_subscriber";

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  subscription_status: SubscriptionStatus;
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
