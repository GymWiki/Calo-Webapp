import { Skeleton } from "@/components/ui/skeleton";

// De detailpagina heeft twee heel verschillende weergaven (eenvoudige
// activiteit vs. wizard-activiteit, zie isWizardActivity in page.tsx) die
// pas bekend zijn nadat de activiteit is opgehaald — deze skeleton
// benadert de gemeenschappelijke vorm (titelblok, grote afbeelding, tabs)
// die in beide gevallen ongeveer klopt.
export default function ActiviteitDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-28 md:space-y-6 md:p-8 md:pb-24">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
      <div className="space-y-4 rounded-xl border p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </main>
  );
}
