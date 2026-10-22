import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaalcheckBeheerLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Beheer · Taalcheck"
        title="Taalcheck-voorstellen beoordelen"
        description="AI-voorstellen voor spelling, grammatica en onduidelijke formuleringen in bestaande activiteiten. Niets wordt overschreven totdat je een voorstel goedkeurt en de wijzigingen toepast."
      />
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
