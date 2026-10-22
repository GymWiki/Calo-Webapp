import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielActiviteitenLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Profiel"
        title="Activiteiten"
        description="Al je activiteiten met status — alleen gedeelde, goedgekeurde activiteiten tellen mee voor je maandelijkse bijdrage."
      />
      <Skeleton className="h-10 w-64 rounded-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
