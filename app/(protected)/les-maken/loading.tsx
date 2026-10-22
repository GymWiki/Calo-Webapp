import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// LesMakenPage moet o.a. profiel + (optioneel) een bestaande activiteit
// ophalen vóór het zelfs de titel kan tonen ("Kies hoe je wilt beginnen" vs.
// "Concept ... hervatten") — deze skeleton is dus generiek in plaats van
// specifiek voor één van die varianten.
export default function LesMakenLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl xl:max-w-6xl">
      <PageHeader eyebrow="Activiteit maken" title="Nieuwe activiteit" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
