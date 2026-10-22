import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function KennisbankBeheerLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Kennisbank · Beheer"
        title="Standaardbibliotheek beheren"
        description="Pakketten en documenten voor de door GymWiki beheerde literatuurbibliotheek. Zichtbaar/aanzetbaar voor gebruikers alleen wanneer een pakket actief is."
      />
      <Skeleton className="h-11 w-40 rounded-md" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
