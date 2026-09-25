import { LessonEntriesSkeleton } from "@/components/planning/LessonEntriesSkeleton";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielPlanningClassLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <Skeleton className="h-8 w-20" />
      <PageHeader eyebrow="Klas" title="Laden…" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="space-y-3">
        <LessonEntriesSkeleton />
      </div>
    </main>
  );
}
