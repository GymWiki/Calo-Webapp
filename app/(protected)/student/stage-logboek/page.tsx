import { NotebookText } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function StageLogboekPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Stage-logboek"
        title="Stage-logboek"
        description="Houd je stage-uren, reflecties en begeleidingsmomenten bij."
      />
      <EmptyState
        icon={NotebookText}
        title="Binnenkort beschikbaar"
        description="Hier kun je straks per stagedag je uren en reflecties vastleggen, direct te delen met je praktijkbegeleider."
      />
    </main>
  );
}
