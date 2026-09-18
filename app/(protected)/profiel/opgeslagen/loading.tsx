import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielOpgeslagenLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 xl:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Opgeslagen activiteiten"
        description="Je favoriete activiteiten uit de bibliotheek."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
