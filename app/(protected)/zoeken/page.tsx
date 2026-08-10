import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicLessons } from "@/lib/services/lessons";
import { SearchClient } from "./search-client";

export default function ZoekenPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Zoeken"
        title="Vind een lesvoorbereiding"
        description="Doorzoek de openbaar gedeelde lessen op titel, groep, leerlijn of bewegingsthema."
      />
      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent />
      </Suspense>
    </main>
  );
}

async function ZoekenContent() {
  const lessons = await getPublicLessons();
  return <SearchClient lessons={lessons} />;
}
