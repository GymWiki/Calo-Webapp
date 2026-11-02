import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-8 sm:py-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </main>
  );
}
