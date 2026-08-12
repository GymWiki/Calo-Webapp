import type { UserProfile } from "@/lib/types";

export interface UserPermissions {
  isPro: boolean;
  canExportPdf: boolean;
  canManagePersonalKnowledgeBase: boolean;
  canDuplicateActivity: boolean;
  maxSavedLessons: number;
  monthlyAiLimit: number;
}

/**
 * Central source of truth for Gratis-vs-Pro rechten en limieten. Accepts a
 * loosely-typed profile (a full UserProfile, a partial select like
 * `{ is_pro }`, or null/undefined for a signed-out visitor) so callers
 * never need to fetch more than they already have just to check a flag.
 */
export function getUserPermissions(
  profile: Pick<UserProfile, "is_pro"> | null | undefined,
): UserPermissions {
  const isPro = profile?.is_pro ?? false;

  return {
    isPro,
    canExportPdf: isPro,
    canManagePersonalKnowledgeBase: isPro,
    canDuplicateActivity: isPro,
    maxSavedLessons: isPro ? Infinity : 3,
    monthlyAiLimit: isPro ? Infinity : 2,
  };
}
