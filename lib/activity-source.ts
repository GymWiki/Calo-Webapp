import type { Activity } from "@/types/activity";

/**
 * Eén centrale plek om te bepalen waar een activiteit vandaan komt — eerder
 * werd dit op meerdere plekken losjes/inconsistent afgeleid (soms alleen op
 * `author_id`, zonder `is_public` mee te wegen), waardoor een eigen,
 * PRIVÉ-activiteit (wel een author_id, maar niet gedeeld) onterecht als
 * "Publiek" of zelfs "GymWiki" kon worden getoond. Gebruikt door zowel de
 * kaartcomponent (components/library-item-card.tsx) als de detailpagina
 * (app/(protected)/activiteit/[id]/page.tsx), zodat ze nooit meer uit elkaar
 * kunnen lopen.
 */
export type ActivitySource = "gymwiki" | "publiek" | "eigen";

export function getActivitySource(
  activity: Pick<Activity, "author_id" | "is_public">,
): ActivitySource {
  if (activity.author_id === null) return "gymwiki";
  if (activity.is_public) return "publiek";
  return "eigen";
}
