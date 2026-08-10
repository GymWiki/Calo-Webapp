import { Handshake } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function MarktplaatsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Marktplaats"
        title="Theorieboeken-marktplaats"
        description="Tweedehands studieboeken kopen en verkopen met medestudenten."
      />
      <EmptyState
        icon={Handshake}
        title="Binnenkort beschikbaar"
        description="We bouwen aan een plek waar je theorieboeken kunt aanbieden en vinden bij andere CALO-studenten. Hou deze pagina in de gaten."
      />
    </main>
  );
}
