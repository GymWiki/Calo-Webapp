import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfielInstellingenLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Accountinstellingen"
        description="Beheer je gegevens en voorkeuren."
      />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </main>
  );
}
