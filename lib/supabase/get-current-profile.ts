import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getEffectiveAccess } from "@/lib/services/teams";
import type { SubscriptionStatus, UserProfile } from "@/lib/types";

export const getCurrentUserProfile = cache(
  async (): Promise<UserProfile | null> => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Twee onafhankelijke aanroepen: het profiel zelf, en de EFFECTIEVE
    // toegangsstatus (eigen betaling OF actief teamlidmaatschap, zie
    // public.get_effective_access — supabase/migrations/team_plans.sql).
    // Die laatste overschrijft profile.subscription_status hieronder zodat
    // ELKE consument van getCurrentUserProfile() (de meeste pagina's,
    // lib/permissions.ts, getContributionStatus) een teamlid automatisch
    // als paid_subscriber behandelt, zonder zelf iets van teams te hoeven
    // weten. Beide mogen gerust parallel: geen afhankelijkheid tussen ze.
    const [{ data: profile }, access] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, first_name, last_name, avatar_url, available_for_internship, role_label, subscription_status, subscription_type, library_preview_activity_ids, holiday_region",
        )
        .eq("id", user.id)
        .single(),
      getEffectiveAccess(supabase),
    ]);

    if (!profile) {
      return null;
    }

    return {
      ...profile,
      email: user.email ?? null,
      subscription_status: (access?.effective_status as SubscriptionStatus) ?? profile.subscription_status,
      team_id: access?.team_id ?? null,
      team_role: (access?.team_role as "owner" | "member" | null) ?? null,
      team_name: access?.team_name ?? null,
    } as UserProfile;
  },
);
