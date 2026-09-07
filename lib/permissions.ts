import { getLevelInfo } from "@/config/levels";
import type { UserProfile } from "@/lib/types";

// Elk plan_type dat als "Pro" telt — plan_type zelf is bewust een vrije
// tekstkolom (zie UserProfile) zodat een beheerder in de Supabase Table
// Editor nieuwe tiers kan introduceren zonder codewijziging; deze lijst is
// de enige plek die bepaalt wélke tiers de Pro-functies vrijgeven.
const PRO_PLAN_TYPES = new Set(["pro", "organization", "admin"]);

export interface UserPermissions {
  planType: string;
  isPro: boolean;
  canExportPdf: boolean;
  canManagePersonalKnowledgeBase: boolean;
  canDuplicateActivity: boolean;
  maxSavedLessons: number;
  monthlyAiLimit: number;
}

/**
 * Central source of truth for Gratis-vs-Pro rechten en limieten — combineert
 * level (uit xp) én tier (plan_type) tot één set voordelen, zodat level en
 * tier volledig los van elkaar staan: een gratis gebruiker die Pro wordt
 * behoudt zijn level en de bijbehorende voordelen worden direct toegepast,
 * zonder aparte "Pro-XP" of reset. Accepts a loosely-typed profile (a full
 * UserProfile, a partial select like `{ plan_type, xp }`, or null/undefined
 * for a signed-out visitor) so callers never need to fetch more than they
 * already have just to check a flag.
 */
export function getUserPermissions(
  profile: Pick<UserProfile, "plan_type" | "xp"> | null | undefined,
): UserPermissions {
  const planType = profile?.plan_type || "free";
  const isPro = PRO_PLAN_TYPES.has(planType);
  const level = getLevelInfo(profile?.xp ?? 0);

  return {
    planType,
    isPro,
    canExportPdf: isPro,
    canManagePersonalKnowledgeBase: isPro,
    canDuplicateActivity: isPro,
    maxSavedLessons: isPro ? Infinity : 3,
    monthlyAiLimit: isPro ? Infinity : level.freeMonthlyAiLimit,
  };
}

// Alias gevraagd door de gamification-opdracht ("getUserBenefits(userId)")
// — bewust géén aparte implementatie: getUserPermissions was al de ene
// centrale bron van waarheid voor Gratis-vs-Pro rechten in deze codebase,
// en die combineert level+tier al exact zoals gevraagd.
export const getUserBenefits = getUserPermissions;
