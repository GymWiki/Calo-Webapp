import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback voor de Suspense-boundary rond WeekScheduleSection — zowel bij
 * het eerste bezoek van /profiel/planning als bij weeknavigatie (de
 * boundary wordt opnieuw getriggerd zodra `?week=` wijzigt).
 */
export function WeekScheduleSkeleton() {
  return <Skeleton className="h-[420px] w-full rounded-2xl" />;
}
