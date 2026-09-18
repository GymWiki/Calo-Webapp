import { Skeleton } from "@/components/ui/skeleton";

// Next.js wrapt page.tsx automatisch in een <Suspense fallback={<Loading/>}>
// — dit verschijnt INSTANT bij navigatie (geprefetcht, zie loading.js-docs),
// nog vóórdat DashboardPage's eigen awaits (profiel, bijdragestatus) zijn
// opgelost. Vorm volgt DashboardPage/DashboardSkeleton zodat er geen
// layoutverspringing is wanneer de echte content 'm vervangt.
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl xl:max-w-[1360px]">
      <div className="animate-fade-up">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <Skeleton className="h-24 w-full rounded-2xl" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
