import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ZoekenLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 xl:max-w-[1400px]">
      <PageHeader
        eyebrow="Bibliotheek"
        title="Ontdek activiteiten"
        description="GymWiki-activiteiten uit de gezamenlijke bibliotheek en publiek gedeelde activiteiten, in één doorzoekbaar overzicht."
      />
      <Skeleton className="h-11 w-full rounded-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
