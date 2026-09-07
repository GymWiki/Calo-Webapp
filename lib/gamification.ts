import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserPermissions } from "@/lib/permissions";
import { LEVELS, getLevelInfo, getNextLevel, type ContributionQuota, type Level } from "@/config/levels";

export { LEVELS, getLevelInfo, getNextLevel };
export type { ContributionQuota, Level };

// -- XP-beloningen --------------------------------------------------------
// Dekt de acties die er in GymWiki daadwerkelijk bestaan: een les
// aanmaken ("uploads"), een les openbaar delen in de bibliotheek, een
// activiteit uit de bibliotheek opslaan ("saves"), en de nieuwe
// engagement-beloningen (login-streaks, lidmaatschapsjubileum). Er is
// (nog) geen like-/review-functie op lessen/activiteiten, dus die
// XP-bron uit de oorspronkelijke opdracht heeft geen aanknopingspunt in
// de huidige app.
//
// Let op: loginStreak7/30 en membershipAnniversary staan hier alléén ter
// documentatie/UI-weergave — de daadwerkelijke, atomaire toekenning
// gebeurt in de record_login_activity-RPC (supabase/migrations/
// gamification_v2.sql), die deze bedragen hard codeert. Wijzig je deze
// getallen, werk dan ook die migratie bij.
export const XP_REWARDS = {
  lessonCreated: 20,
  lessonShared: 10,
  activitySaved: 5,
  loginStreak7: 10,
  loginStreak30: 40,
  membershipAnniversary: 150,
} as const;

export type XpReason =
  | "lesson_created"
  | "lesson_shared"
  | "activity_saved"
  | "login_streak_7"
  | "login_streak_30"
  | "membership_anniversary";

export function getXpProgress(xp: number): {
  current: Level;
  next: Level | null;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progressPercent: number;
} {
  const current = getLevelInfo(xp);
  const next = getNextLevel(xp);
  const xpIntoLevel = xp - current.xpRequired;
  const xpForNextLevel = next ? next.xpRequired - current.xpRequired : null;
  const progressPercent =
    xpForNextLevel && xpForNextLevel > 0
      ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
      : 100;

  return { current, next, xpIntoLevel, xpForNextLevel, progressPercent };
}

// -- Pro-pricing ------------------------------------------------------------

export const PRO_BASE_PRICE_CENTS = 999; // € 9,99 / mnd

export function getDiscountedPriceCents(freeDiscountPercent: number): number {
  return Math.round(PRO_BASE_PRICE_CENTS * (1 - freeDiscountPercent / 100));
}

export function formatEuroCents(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

// -- XP toekennen -----------------------------------------------------------

export type LevelUpEvent = {
  oldLevel: Level;
  newLevel: Level;
  isPro: boolean;
};

export type AwardXpResult = {
  xp: number;
  /** Werkelijk toegekend bedrag — kan lager zijn dan het gevraagde bedrag door diminishing returns (zie award_xp-RPC). */
  awardedAmount: number;
  levelUp: LevelUpEvent | null;
};

/**
 * Kent XP toe aan de ingelogde gebruiker via de award_xp RPC (atomair, en
 * door RLS beperkt tot de eigen rij) en signaleert of dit een level-up
 * veroorzaakte, zodat de aanroepende server action dat in zijn
 * ActionResult kan meesturen voor een client-side melding. Voor reason
 * "lesson_created" past de RPC zelf diminishing returns toe (vanaf de 4e
 * les die kalenderweek wordt het bedrag gehalveerd) — awardedAmount geeft
 * het daadwerkelijk bijgeschreven bedrag terug.
 */
export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  reason: XpReason,
  relatedLessonId?: string,
): Promise<AwardXpResult> {
  const { data, error } = await supabase
    .rpc("award_xp", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_related_lesson_id: relatedLessonId ?? null,
    })
    .single<{
      old_xp: number;
      new_xp: number;
      is_pro: boolean;
      awarded_amount: number;
    }>();

  if (error || !data) {
    // Nooit de aanroepende actie laten falen om een XP-boekhoudfout —
    // de kernactie (les opslaan, delen, activiteit bewaren) is al gelukt.
    return { xp: 0, awardedAmount: 0, levelUp: null };
  }

  const oldLevel = getLevelInfo(data.old_xp);
  const newLevel = getLevelInfo(data.new_xp);

  return {
    xp: data.new_xp,
    awardedAmount: data.awarded_amount,
    levelUp:
      newLevel.level > oldLevel.level
        ? { oldLevel, newLevel, isPro: data.is_pro }
        : null,
  };
}

// -- Login-activiteit (streaks + lidmaatschapsjubileum) ----------------------

export type LoginActivityResult = {
  loginStreakCurrent: number;
  streakBonusAwarded: number;
  anniversaryBonusAwarded: boolean;
};

/**
 * Werkt de login-streak/last_active_at bij en kent — atomair, in dezelfde
 * RPC — de 7-daagse/30-daagse streakbonus en de jaarlijkse
 * lidmaatschapsbonus toe wanneer die net gehaald zijn. Best-effort: een
 * fout hier mag een geslaagde login nooit blokkeren.
 */
export async function recordLoginActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoginActivityResult | null> {
  try {
    const { data, error } = await supabase
      .rpc("record_login_activity", { p_user_id: userId })
      .single<{
        login_streak_current: number;
        streak_bonus_awarded: number;
        anniversary_bonus_awarded: boolean;
      }>();

    if (error || !data) {
      return null;
    }

    return {
      loginStreakCurrent: data.login_streak_current,
      streakBonusAwarded: data.streak_bonus_awarded,
      anniversaryBonusAwarded: data.anniversary_bonus_awarded,
    };
  } catch {
    return null;
  }
}

// -- Contributiequotum --------------------------------------------------------

export type ContributionStatus = {
  /** false voor Pro-leden en voor het hoogste level (geen quotum). */
  required: boolean;
  quota: ContributionQuota | null;
  count: number;
  met: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
};

/**
 * Bepaalt of een gratis gebruiker binnen de huidige contributieperiode
 * (afgeleid van member_since + het periodeduur van het huidige level, geen
 * apart bijgehouden "periode-start" nodig) genoeg lessen heeft aangemaakt.
 * Pro-gebruikers en level 10 (geen quotum) slaan de check altijd over.
 */
export async function checkContributionStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContributionStatus> {
  const empty: ContributionStatus = {
    required: false,
    quota: null,
    count: 0,
    met: true,
    periodStart: null,
    periodEnd: null,
  };

  const { data: profile } = await supabase
    .from("users")
    .select("xp, plan_type, member_since")
    .eq("id", userId)
    .single();

  if (!profile) {
    return empty;
  }

  const { isPro } = getUserPermissions(profile);
  const level = getLevelInfo(profile.xp);
  const quota = level.contributionQuota;

  if (isPro || !quota) {
    return { ...empty, quota };
  }

  const memberSince = new Date(profile.member_since as string);
  const now = new Date();
  const monthsSinceMember =
    (now.getFullYear() - memberSince.getFullYear()) * 12 +
    (now.getMonth() - memberSince.getMonth());
  const periodIndex = Math.floor(monthsSinceMember / quota.periodMonths);

  const periodStart = new Date(memberSince);
  periodStart.setMonth(periodStart.getMonth() + periodIndex * quota.periodMonths);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + quota.periodMonths);

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", periodStart.toISOString())
    .lt("created_at", periodEnd.toISOString());

  const actualCount = count ?? 0;

  return {
    required: true,
    quota,
    count: actualCount,
    met: actualCount >= quota.amount,
    periodStart,
    periodEnd,
  };
}
