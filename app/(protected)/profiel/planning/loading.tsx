import { WeekScheduleSkeleton } from "@/components/planning/WeekScheduleSkeleton";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielPlanningLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Planning"
        description="Klassen en een weekrooster met geplande lesmomenten."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
      <WeekScheduleSkeleton />
    </main>
  );
}
