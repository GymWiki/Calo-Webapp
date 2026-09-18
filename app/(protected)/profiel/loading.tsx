import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader eyebrow="Profiel" title="Jouw GymWiki-hub" description="Alles wat bij jouw account hoort, op één plek." />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </main>
  );
}
