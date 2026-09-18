import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function KennisbankLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Kennisbank"
        title="Kennisbank"
        description="Vakliteratuur voor de AI Activiteitenchecker en AI Lescoach — je eigen uploads en de door GymWiki beheerde Standaardbibliotheek."
      />
      <Skeleton className="h-10 w-72 rounded-md" />
      <div className="grid gap-6 lg:grid-cols-[26rem_1fr] lg:items-start lg:gap-8">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
