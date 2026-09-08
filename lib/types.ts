export type SubscriptionStatus = "free_contributor" | "free_blocked" | "paid_subscriber";

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  subscription_status: SubscriptionStatus;
  email: string | null;
};
