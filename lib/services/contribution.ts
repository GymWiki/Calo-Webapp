import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionStatus } from "@/lib/types";

export type ContributionStatus = {
  /** false voor betaalde abonnees: geen bijdrage-eis. */
  required: boolean;
  requiredCount: number;
  approvedCount: number;
  met: boolean;
  periodStart: Date;
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Leest de lopende-maand-telling uit monthly_contribution_tracking
 * (bijgewerkt door de activiteiten_sync_contribution-trigger bij elke
 * goedkeuring — zie supabase/migrations/subscription_model.sql). Geen rij
 * betekent nog geen goedgekeurde bijdragen deze maand.
 */
export async function getContributionStatus(
  supabase: SupabaseClient,
  userId: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<ContributionStatus> {
  const periodStart = startOfMonth();

  if (subscriptionStatus === "paid_subscriber") {
    return { required: false, requiredCount: 4, approvedCount: 0, met: true, periodStart };
  }

  const { data } = await supabase
    .from("monthly_contribution_tracking")
    .select("required_count, approved_count")
    .eq("user_id", userId)
    .eq("period_start", periodStart.toISOString().slice(0, 10))
    .maybeSingle();

  const requiredCount = data?.required_count ?? 4;
  const approvedCount = data?.approved_count ?? 0;

  return {
    required: true,
    requiredCount,
    approvedCount,
    met: approvedCount >= requiredCount,
    periodStart,
  };
}
