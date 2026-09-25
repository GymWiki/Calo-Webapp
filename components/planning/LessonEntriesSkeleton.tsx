import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback voor de Suspense-boundary rond ClassLessonEntriesSection — zowel
 * bij het eerste bezoek van een klas-pagina als bij maandnavigatie (de
 * boundary wordt opnieuw getriggerd zodra `?maand=` wijzigt). Ook hergebruikt
 * in [classId]/loading.tsx zodat beide skeletons exact hetzelfde ogen.
 */
export function LessonEntriesSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </>
  );
}
